/**
 * Deterministic dataset generation (MOCK-040 … MOCK-046, MOCK-060).
 *
 * Everything derives from one seeded RNG stream, so `makeDataset('42')` is
 * byte-identical on every call (TEST-021). The design keeps the four BC views
 * mutually consistent:
 *
 *   - Inventory (qoh) and open POs (onPO) live in two maps keyed by item+location.
 *   - Projects reference (item, location) pairs with a `required` quantity.
 *   - The Demand endpoint is built directly FROM the project items, so it is
 *     exactly the flattened union of all projects (MOCK-044 / TEST-022), and
 *     `netInventory = qoh + onPO − demand` is computed literally for every row
 *     (MOCK-012 / TEST-024).
 *
 * Six MOCK-045 edge cases are injected deterministically onto dedicated
 * projects/items so tests can always find them.
 */
import type {
  BcInventoryRow,
  BcPurchaseOrderRow,
  BcDemandRow,
  BcProjectResponse,
  BcProjectItem,
  SaleHeader,
  LocationOption,
} from '@inventory/shared';
import { SATELLITES } from '@inventory/shared';
import { makeRng } from './rng';
import type { Rng } from './rng';
import { FLOORING, ADDITIONAL, CATALOG } from './catalog';
import type { CatalogItem } from './catalog';

export interface Dataset {
  inventory: BcInventoryRow[];
  purchaseOrders: BcPurchaseOrderRow[];
  demand: BcDemandRow[];
  projects: Map<string, BcProjectResponse>;
  saleHeaders: SaleHeader[];
}

// FIXED base date — never `Date.now()` — so PO/install dates are stable forever.
const BASE_DATE = Date.UTC(2026, 0, 1); // 2026-01-01 UTC
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FIRST_NAMES = [
  'John', 'Mary', 'Robert', 'Linda', 'Michael', 'Patricia', 'James',
  'Jennifer', 'David', 'Susan', 'William', 'Karen', 'Richard', 'Sandi',
];
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Ball', 'Lopez', 'Gonzalez', 'Elias',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "YYYY-MM-DD" for BASE_DATE + offset days (UTC — TZ-independent). */
function ymd(offsetDays: number): string {
  const d = new Date(BASE_DATE + offsetDays * DAY_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** "M/D/YY (Day)" for BASE_DATE + offset days. */
function installDate(offsetDays: number): string {
  const d = new Date(BASE_DATE + offsetDays * DAY_MS);
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${yy} (${WEEKDAYS[d.getUTCDay()]})`;
}

const key = (no: string, loc: string): string => `${no}|${loc}`;

interface PoInfo {
  qpo: number;
  sfdcSoNo: string;
  purchNo: string;
  expected_Receipt_Date: string;
}

/** One project item before it is projected into demand / project-item shape. */
interface PItem {
  cat: CatalogItem;
  /** Real location code used for qoh/onPO lookup and itemKey. */
  locId: string;
  /** Exposed locationCode (may be null for edge case b). */
  locationCode: string | null;
  /** Exposed locationName (may mismatch code for edge case c). */
  locationName: string;
  required: number;
}

interface Project {
  projectNo: string;
  satellite: LocationOption;
  first: string;
  last: string;
  floorCount: number;
  items: PItem[];
}

export function makeDataset(seed: string): Dataset {
  const rng = makeRng(`dataset:${seed}`);
  const satellites = SATELLITES;

  // ── Inventory (qoh) and PO maps, keyed by item+location (MOCK-043 / MOCK-046).
  const qoh = new Map<string, number>();
  const po = new Map<string, PoInfo>();
  let poCounter = 12000;

  const makePo = (r: Rng): PoInfo => {
    poCounter += r.int(1, 9);
    return {
      qpo: r.int(20, 100),
      sfdcSoNo: r.bool(0.5) ? '' : `SO-${r.int(100000, 999999)}`,
      purchNo: `PO-0${String(poCounter).padStart(5, '0')}`,
      expected_Receipt_Date: ymd(r.int(1, 30)),
    };
  };

  for (const item of CATALOG) {
    const count = rng.int(3, 8);
    // Deterministic subset of satellites (shuffle a copy, take `count`).
    const pool = satellites.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      const tmp = pool[i]!;
      pool[i] = pool[j]!;
      pool[j] = tmp;
    }
    for (const loc of pool.slice(0, count)) {
      qoh.set(key(item.no, loc.code), rng.int(0, 250));
      if (rng.bool(0.25)) po.set(key(item.no, loc.code), makePo(rng));
    }
  }

  // ── Projects (MOCK-044): ≥ 12 projects, each tied to one satellite.
  const PROJECT_COUNT = 14;
  const projects: Project[] = [];
  for (let i = 0; i < PROJECT_COUNT; i++) {
    const satellite = satellites[i % satellites.length]!;
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const floorCount = rng.int(1, 2);
    const addCount = rng.int(3, 6);

    const items: PItem[] = [];
    const usedFloor = new Set<number>();
    const usedAdd = new Set<number>();
    for (let f = 0; f < floorCount; f++) {
      let idx = rng.int(0, FLOORING.length - 1);
      while (usedFloor.has(idx)) idx = rng.int(0, FLOORING.length - 1);
      usedFloor.add(idx);
      items.push({
        cat: FLOORING[idx]!,
        locId: satellite.code,
        locationCode: satellite.code,
        locationName: satellite.name,
        required: rng.int(1, 40),
      });
    }
    for (let a = 0; a < addCount; a++) {
      let idx = rng.int(0, ADDITIONAL.length - 1);
      while (usedAdd.has(idx)) idx = rng.int(0, ADDITIONAL.length - 1);
      usedAdd.add(idx);
      items.push({
        cat: ADDITIONAL[idx]!,
        locId: satellite.code,
        locationCode: satellite.code,
        locationName: satellite.name,
        required: rng.int(1, 30),
      });
    }

    projects.push({
      projectNo: `PRJ5${String(i + 1).padStart(4, '0')}`,
      satellite,
      first,
      last,
      floorCount,
      items,
    });
  }

  // ── Deterministic edge-case injection (MOCK-045). Uses dedicated projects so
  //    tests can always find each case; overrides the maps to stay consistent.
  const setQoh = (it: PItem, v: number): void => {
    qoh.set(key(it.cat.no, it.locId), v);
  };
  const clearPo = (it: PItem): void => {
    po.delete(key(it.cat.no, it.locId));
  };
  const setPo = (it: PItem, qpoVal: number): void => {
    poCounter += rng.int(1, 9);
    po.set(key(it.cat.no, it.locId), {
      qpo: qpoVal,
      sfdcSoNo: '',
      purchNo: `PO-0${String(poCounter).padStart(5, '0')}`,
      expected_Receipt_Date: ymd(rng.int(1, 30)),
    });
  };

  const p = (i: number): Project => projects[i]!;
  const flooringItems = (proj: Project): PItem[] => proj.items.slice(0, proj.floorCount);
  const additionalItems = (proj: Project): PItem[] => proj.items.slice(proj.floorCount);

  // (d) P0 — fully ready: every item has qoh ≥ required (all on hand).
  for (const it of p(0).items) {
    it.required = rng.int(5, 30);
    setQoh(it, it.required + rng.int(5, 50));
  }

  // (e) P1 — flooring ready, additional short (drives gold callout WEB-042).
  for (const it of flooringItems(p(1))) {
    it.required = rng.int(5, 25);
    setQoh(it, it.required + rng.int(5, 40));
  }
  {
    const shortAdd = additionalItems(p(1))[0]!;
    shortAdd.required = rng.int(25, 60);
    setQoh(shortAdd, rng.int(0, 4)); // qoh + onPO < required
    clearPo(shortAdd); // no covering PO  → netInventory < 0  (negative #1)
  }

  // (f) P2 — an item with qoh 0, demand > 0, open PO covering the shortage.
  {
    const it = flooringItems(p(2))[0]!;
    it.required = rng.int(20, 60);
    setQoh(it, 0);
    setPo(it, it.required + rng.int(5, 30)); // PO covers → netInventory ≥ 0
  }

  // (a) two more negative-netInventory rows (P3, P4) → ≥ 3 total with (e).
  for (const i of [3, 4]) {
    const it = flooringItems(p(i))[0]!;
    it.required = rng.int(25, 60);
    setQoh(it, rng.int(0, 3));
    clearPo(it);
  }

  // (b) P5 — two demand rows with locationCode: null (itemKey keeps its LOC).
  for (const it of p(5).items.slice(0, 2)) {
    it.locationCode = null;
  }

  // (c) P6 — location name/code mismatch row: "Grand Rapids" under code "DET".
  {
    const it = p(6).items[0]!;
    it.locId = 'DET';
    it.locationCode = 'DET';
    it.locationName = 'Grand Rapids';
    if (!qoh.has(key(it.cat.no, 'DET'))) setQoh(it, rng.int(0, 20));
  }

  // ── Project a PItem into a (demandRow, projectItem) pair.
  const project = (
    proj: Project,
    it: PItem,
  ): { demandRow: BcDemandRow; projectItem: BcProjectItem } => {
    const qohVal = qoh.get(key(it.cat.no, it.locId)) ?? 0;
    const poInfo = po.get(key(it.cat.no, it.locId));
    const onPO = poInfo?.qpo ?? 0;
    const netInventory = qohVal + onPO - it.required;
    const itemKey = `${it.cat.no}-${it.locId}`;
    const projectName = `Vinyl Flooring : ${proj.last}, ${proj.first}`;

    const demandRow: BcDemandRow = {
      no: it.cat.no,
      description: it.cat.description,
      qoh: qohVal,
      onPO,
      demand: it.required,
      netInventory,
      locationName: it.locationName,
      locationCode: it.locationCode,
      itemKey,
      projectName,
    };
    const projectItem: BcProjectItem = {
      ...demandRow,
      itemCategoryCode: it.cat.itemCategoryCode,
      sqftPerCase: it.cat.sqftPerCase,
      linearFtPerUnit: it.cat.linearFtPerUnit,
      required: it.required,
    };
    return { demandRow, projectItem };
  };

  // ── Build Demand (union of all project items) and per-project responses.
  const demand: BcDemandRow[] = [];
  const projectResponses = new Map<string, BcProjectResponse>();
  const saleHeaders: SaleHeader[] = [];

  projects.forEach((proj, i) => {
    const items: BcProjectItem[] = [];
    for (const it of proj.items) {
      const { demandRow, projectItem } = project(proj, it);
      demand.push(demandRow);
      items.push(projectItem);
    }
    projectResponses.set(proj.projectNo, { projectNo: proj.projectNo, items });

    saleHeaders.push({
      projectNo: proj.projectNo,
      saleNo: `S00${String(i + 1).padStart(3, '0')}`,
      customer: `${proj.last}, ${proj.first}`,
      satelliteCode: proj.satellite.code,
      satelliteName: proj.satellite.name,
      bcStatus: rng.bool(0.5) ? 'Open' : 'Released',
      fileStatus: rng.pick(['Step 2', 'Step 3', 'Step 4', 'Step 5']),
      installDate: installDate(7 + i * 3 + rng.int(0, 6)),
    });
  });

  // ── Materialize Inventory and PurchaseOrders from the maps (sorted, stable).
  const catByNo = new Map<string, CatalogItem>(CATALOG.map((c) => [c.no, c]));
  const nameByCode = new Map<string, string>(satellites.map((s) => [s.code, s.name]));

  const invKeys = [...qoh.keys()].sort();
  const inventory: BcInventoryRow[] = invKeys.map((k) => {
    const [no, loc] = k.split('|') as [string, string];
    const cat = catByNo.get(no)!;
    return {
      no,
      description: cat.description,
      i360Id: cat.i360Id,
      sqftPerCase: cat.sqftPerCase,
      linearFtPerUnit: cat.linearFtPerUnit,
      itemCategoryCode: cat.itemCategoryCode,
      locationCode: loc,
      locationName: nameByCode.get(loc) ?? loc,
      qoh: qoh.get(k)!,
    };
  });

  const poKeys = [...po.keys()].sort();
  const purchaseOrders: BcPurchaseOrderRow[] = poKeys.map((k) => {
    const [no, loc] = k.split('|') as [string, string];
    const cat = catByNo.get(no)!;
    const info = po.get(k)!;
    return {
      no,
      description: cat.description,
      i360Id: cat.i360Id,
      sqftPerCase: cat.sqftPerCase,
      linearFtPerUnit: cat.linearFtPerUnit,
      itemCategoryCode: cat.itemCategoryCode,
      locationCode: loc,
      locationName: nameByCode.get(loc) ?? loc,
      qpo: info.qpo,
      sfdcSoNo: info.sfdcSoNo,
      purchNo: info.purchNo,
      expected_Receipt_Date: info.expected_Receipt_Date,
    };
  });

  return { inventory, purchaseOrders, demand, projects: projectResponses, saleHeaders };
}
