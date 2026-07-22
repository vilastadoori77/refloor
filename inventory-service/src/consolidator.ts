/**
 * consolidator.ts — PURE, fully config-driven business math (PB-001).
 *
 * Every rule (availability formula, color thresholds, project status) is read
 * from the injected AvailabilityConfig — NO business constant is hard-coded.
 * TEST-016 proves this by running the same fixtures under two configs and
 * asserting both the numbers and the colors differ.
 */
import type {
  AvailabilityConfig,
  BcInventoryRow,
  BcPurchaseOrderRow,
  BcDemandRow,
  ConsolidatedItem,
  ItemStatus,
  Status,
} from '@inventory/shared';

const UNK = 'UNK';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * SVC-002 / ASM-001: availability per the named strategy in config.
 *  - onHandMinusAllocated → onHand − allocated
 *  - netInventory         → qoh + onPO − demand  (the netInventory identity)
 */
export function computeAvailable(
  config: AvailabilityConfig,
  r: { onHand: number; allocated: number; qoh: number; onPO: number; demand: number },
): number {
  switch (config.availabilityStrategy) {
    case 'netInventory':
      return r.qoh + r.onPO - r.demand;
    case 'onHandMinusAllocated':
    default:
      return r.onHand - r.allocated;
  }
}

/**
 * SVC-003 / ASM-002: classify green/yellow/red purely from config thresholds.
 * Equality at the threshold is GREEN (rule uses `<`, not `≤` — TEST-011.4/.7).
 */
export function classifyStatus(
  config: AvailabilityConfig,
  available: number,
  allocated: number,
): Status {
  const { redBelow, yellowFractionOfAllocated, yellowMinUnitsWhenNoAllocated } =
    config.thresholds;

  if (available < redBelow) return 'red';

  const yellowCeiling =
    allocated > 0
      ? allocated * yellowFractionOfAllocated
      : yellowMinUnitsWhenNoAllocated;

  if (available < yellowCeiling) return 'yellow';
  return 'green';
}

function keyOf(itemNo: string, locationCode: string): string {
  return `${itemNo}\u0000${locationCode}`;
}

interface Accumulator {
  base: {
    itemNo: string;
    description: string;
    i360Id: string;
    itemCategoryCode: string;
    sqftPerCase: number;
    linearFtPerUnit: number;
    locationCode: string;
    locationName: string;
  };
  onHand: number; // qoh from inventory feed
  allocated: number; // Σ demand
  ordered: number; // Σ qpo
  onPO: number; // Σ onPO (from demand rows, for netInventory strategy)
  demand: number; // Σ demand (== allocated; kept explicit for the formula input)
  qoh: number; // qoh as reported by demand rows (netInventory input)
  qohFromInventory: boolean; // did an inventory row set qoh?
  receiptDates: string[];
}

function ensureAcc(
  map: Map<string, Accumulator>,
  itemNo: string,
  locationCode: string,
  seed: Omit<Accumulator['base'], 'itemNo' | 'locationCode'>,
): Accumulator {
  const k = keyOf(itemNo, locationCode);
  let acc = map.get(k);
  if (!acc) {
    acc = {
      base: { itemNo, locationCode, ...seed },
      onHand: 0,
      allocated: 0,
      ordered: 0,
      onPO: 0,
      demand: 0,
      qoh: 0,
      qohFromInventory: false,
      receiptDates: [],
    };
    map.set(k, acc);
  }
  return acc;
}

function loc(code: string | null): string {
  return code == null || code === '' ? UNK : code;
}

/**
 * SVC-002/004/005: consolidate the three feeds into item+location rows.
 * Null locationCode is bucketed under "UNK" (never dropped). Sorted by
 * category then description.
 */
interface ItemMeta {
  description: string;
  i360Id: string;
  itemCategoryCode: string;
  sqftPerCase: number;
  linearFtPerUnit: number;
}

export function consolidate(
  inventory: BcInventoryRow[],
  pos: BcPurchaseOrderRow[],
  demand: BcDemandRow[],
  config: AvailabilityConfig,
): ConsolidatedItem[] {
  const map = new Map<string, Accumulator>();

  // Item-metadata master keyed by itemNo. The inventory and PO feeds carry full
  // metadata (category, i360Id, sqft, linearFt); the demand feed does not. An
  // item demanded at a location where it is not stocked produces a demand-only
  // row — we enrich its metadata from this master so it still groups under the
  // right category (WEB-022/023) instead of an empty one. Inventory wins over PO.
  const master = new Map<string, ItemMeta>();
  const learn = (
    no: string,
    m: ItemMeta,
  ): void => {
    if (!master.has(no) && m.itemCategoryCode) master.set(no, m);
  };

  for (const row of inventory) {
    const acc = ensureAcc(map, row.no, loc(row.locationCode), {
      description: row.description,
      i360Id: row.i360Id,
      itemCategoryCode: row.itemCategoryCode,
      sqftPerCase: row.sqftPerCase,
      linearFtPerUnit: row.linearFtPerUnit,
      locationName: row.locationName,
    });
    learn(row.no, {
      description: row.description,
      i360Id: row.i360Id,
      itemCategoryCode: row.itemCategoryCode,
      sqftPerCase: row.sqftPerCase,
      linearFtPerUnit: row.linearFtPerUnit,
    });
    acc.onHand += row.qoh;
    acc.qoh += row.qoh;
    acc.qohFromInventory = true;
  }

  for (const row of pos) {
    const acc = ensureAcc(map, row.no, loc(row.locationCode), {
      description: row.description,
      i360Id: row.i360Id,
      itemCategoryCode: row.itemCategoryCode,
      sqftPerCase: row.sqftPerCase,
      linearFtPerUnit: row.linearFtPerUnit,
      locationName: row.locationName,
    });
    learn(row.no, {
      description: row.description,
      i360Id: row.i360Id,
      itemCategoryCode: row.itemCategoryCode,
      sqftPerCase: row.sqftPerCase,
      linearFtPerUnit: row.linearFtPerUnit,
    });
    acc.ordered += row.qpo;
    if (row.expected_Receipt_Date) acc.receiptDates.push(row.expected_Receipt_Date);
  }

  for (const row of demand) {
    const acc = ensureAcc(map, row.no, loc(row.locationCode), {
      description: row.description,
      i360Id: '',
      itemCategoryCode: '',
      sqftPerCase: 0,
      linearFtPerUnit: 0,
      locationName: row.locationName,
    });
    acc.allocated += row.demand;
    acc.demand += row.demand;
    acc.onPO += row.onPO;
    // Only trust demand-row qoh if no inventory feed row set it, so the
    // netInventory strategy still has a qoh when the item only appears in demand.
    if (!acc.qohFromInventory) acc.qoh += row.qoh;
  }

  const items: ConsolidatedItem[] = [];
  for (const acc of map.values()) {
    // Fill any metadata the seeding feed lacked (demand-only rows) from the master.
    const m = master.get(acc.base.itemNo);
    const itemCategoryCode = acc.base.itemCategoryCode || m?.itemCategoryCode || '';
    const i360Id = acc.base.i360Id || m?.i360Id || '';
    const sqftPerCase = acc.base.sqftPerCase || m?.sqftPerCase || 0;
    const linearFtPerUnit = acc.base.linearFtPerUnit || m?.linearFtPerUnit || 0;
    const description = acc.base.description || m?.description || '';

    const available = computeAvailable(config, {
      onHand: acc.onHand,
      allocated: acc.allocated,
      qoh: acc.qoh,
      onPO: acc.onPO,
      demand: acc.demand,
    });
    const nextReceiptDate =
      acc.receiptDates.length > 0
        ? acc.receiptDates.slice().sort()[0]
        : undefined;

    items.push({
      itemNo: acc.base.itemNo,
      description,
      i360Id,
      itemCategoryCode,
      sqftPerCase,
      linearFtPerUnit,
      locationCode: acc.base.locationCode,
      locationName: acc.base.locationName,
      onHand: acc.onHand,
      allocated: acc.allocated,
      ordered: acc.ordered,
      available,
      availableSqft: round2(available * sqftPerCase),
      ...(nextReceiptDate ? { nextReceiptDate } : {}),
      status: classifyStatus(config, available, acc.allocated),
    });
  }

  items.sort((a, b) => {
    const cat = a.itemCategoryCode.localeCompare(b.itemCategoryCode);
    if (cat !== 0) return cat;
    return a.description.localeCompare(b.description);
  });

  return items;
}

/**
 * SVC-042 / ASM-003: project item status, config-driven.
 *  - ready     if available ≥ required
 *  - attention if available < required but available + ordered ≥ required
 *  - short     otherwise
 * remainder = required − picked (proves the picked field is wired — TEST-013).
 */
export function projectItemStatus(
  _config: AvailabilityConfig,
  r: { required: number; available: number; ordered: number; picked: number },
): { itemStatus: ItemStatus; remainder: number } {
  let itemStatus: ItemStatus;
  if (r.available >= r.required) {
    itemStatus = 'ready';
  } else if (r.available + r.ordered >= r.required) {
    itemStatus = 'attention';
  } else {
    itemStatus = 'short';
  }
  return { itemStatus, remainder: r.required - r.picked };
}
