/**
 * @inventory/shared — the single typed contract compiled across the Inventory
 * Service and the React website (PB-007). Three groups of types:
 *
 *   1. BC raw shapes    — what the Mock BC API emits (SPEC 01, must match docx).
 *   2. Business config   — the configurable strategies (ASM-001/002/003, PB-001).
 *   3. Service surface   — snapshot, consolidated rows, internal API envelopes.
 *
 * Nothing here is environment-specific; it is pure types + the default config
 * values. The default values live here so the service and its tests read the
 * SAME defaults (TEST-016 guardrail).
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. BC raw shapes (SPEC 01 — field names/casing MUST match the docx samples)
// ────────────────────────────────────────────────────────────────────────────

export type SourceKey = 'inventory' | 'purchaseOrders' | 'demand';

/** GET /BC/GetInventory row (MOCK-010). */
export interface BcInventoryRow {
  no: string;
  description: string;
  i360Id: string;
  sqftPerCase: number;
  linearFtPerUnit: number;
  itemCategoryCode: string;
  locationCode: string | null;
  locationName: string;
  qoh: number;
}

/** GET /BC/GetPurchaseOrders row (MOCK-011): inventory row minus qoh, plus PO fields. */
export interface BcPurchaseOrderRow {
  no: string;
  description: string;
  i360Id: string;
  sqftPerCase: number;
  linearFtPerUnit: number;
  itemCategoryCode: string;
  locationCode: string | null;
  locationName: string;
  qpo: number;
  sfdcSoNo: string;
  purchNo: string;
  // NOTE: exact casing `expected_Receipt_Date` is contract-critical (TEST-020).
  expected_Receipt_Date: string;
}

/** GET /BC/Demand row (MOCK-012). `netInventory` MUST equal qoh + onPO − demand. */
export interface BcDemandRow {
  no: string;
  description: string;
  qoh: number;
  onPO: number;
  demand: number;
  netInventory: number;
  locationName: string;
  locationCode: string | null;
  itemKey: string;
  projectName: string;
}

/** GET /BC/GetInventoryByProject/:projectNo (MOCK-013). */
export interface BcProjectResponse {
  projectNo: string;
  items: BcProjectItem[];
}

/** Project item row — demand-row shape with itemKey = "IN-xxxxxx-<LOC>". */
export interface BcProjectItem extends BcDemandRow {
  itemCategoryCode: string;
  sqftPerCase: number;
  linearFtPerUnit: number;
  required: number;
}

/** GET /BC/_mock/GetProjects sale header (MOCK-060, replica-only / ASM-005). */
export interface SaleHeader {
  projectNo: string;
  saleNo: string;
  customer: string;
  satelliteCode: string;
  satelliteName: string;
  bcStatus: 'Open' | 'Released';
  fileStatus: string;
  installDate: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Business config — configurable strategies (PB-001 guardrail)
//    NOTHING that touches these values may be hard-coded in the consolidator/UI.
// ────────────────────────────────────────────────────────────────────────────

/** ASM-001 availability formula, selectable at runtime. */
export type AvailabilityStrategy =
  | 'onHandMinusAllocated' // ASM-001 DECIDED default: available = onHand − allocated
  | 'netInventory'; //         alternative: available = qoh + onPO − demand

/** ASM-002 color thresholds (🔶 OPEN — placeholder defaults, PO-tunable). */
export interface ThresholdConfig {
  /** red if available < this (default 0). */
  redBelow: number;
  /** yellow if available < this fraction of allocated (default 0.25). */
  yellowFractionOfAllocated: number;
  /** when allocated === 0, yellow if available < this many units (default 10). */
  yellowMinUnitsWhenNoAllocated: number;
}

/** ASM-003 project item status strategy (🔶 OPEN — placeholder default). */
export type ProjectStatusStrategy = 'availabilityVsRequired';

/** The one config object every business rule reads from (SVC-003/SVC-011). */
export interface AvailabilityConfig {
  /** SVC-010/011 refresh cadence, runtime-mutable. */
  refreshSeconds: number;
  availabilityStrategy: AvailabilityStrategy;
  thresholds: ThresholdConfig;
  projectStatusStrategy: ProjectStatusStrategy;
}

/**
 * Default config = the reviewer decisions of 2026-07-21 (decisions-log.md):
 *   ASM-001 = onHandMinusAllocated; ASM-002/003 = placeholder defaults (OPEN).
 * Local dev refreshSeconds is 60 (ASM-009); Azure sets 300 via env.
 */
export const DEFAULT_CONFIG: AvailabilityConfig = {
  refreshSeconds: 60,
  availabilityStrategy: 'onHandMinusAllocated',
  thresholds: {
    redBelow: 0,
    yellowFractionOfAllocated: 0.25,
    yellowMinUnitsWhenNoAllocated: 10,
  },
  projectStatusStrategy: 'availabilityVsRequired',
};

// ────────────────────────────────────────────────────────────────────────────
// 3. Service surface — consolidated rows, snapshot, internal API envelopes
// ────────────────────────────────────────────────────────────────────────────

export type Status = 'green' | 'yellow' | 'red';

/** One consolidated inventory row keyed by item + location (SVC-002). */
export interface ConsolidatedItem {
  itemNo: string;
  description: string;
  i360Id: string;
  itemCategoryCode: string;
  sqftPerCase: number;
  linearFtPerUnit: number;
  locationCode: string; // canonical key; null → "UNK" (SVC-005)
  locationName: string;
  onHand: number;
  allocated: number;
  ordered: number;
  available: number;
  availableSqft: number;
  nextReceiptDate?: string;
  status: Status;
}

export interface SourceOutcome {
  status: 'ok' | 'failed';
  rowCount: number;
}

/** Immutable per-cycle snapshot (SVC-021/022/023). */
export interface Snapshot {
  refreshedAt: string; // ISO — advances only on a successful cycle
  lastAttemptAt: string; // ISO — advances every cycle attempt
  healthy: boolean;
  consecutiveFailures: number;
  sources: Record<SourceKey, SourceOutcome>;
  items: ConsolidatedItem[];
}

/** Every internal API response is wrapped in this envelope (SVC §5). */
export interface ApiEnvelope<T> {
  refreshedAt: string;
  data: T;
}

export interface LocationOption {
  code: string;
  name: string;
}

/** Project item row rendered on the project screen (WEB-045). */
export interface ProjectItemRow {
  product: string;
  itemCategory: string;
  required: number;
  available: number;
  ordered: number;
  picked: number; // always 0.00 in replica (ASM-004)
  remainder: number; // required − picked (ASM-003)
  itemStatus: ItemStatus;
}

export type ItemStatus = 'ready' | 'attention' | 'short';

export interface ProjectTotals {
  required: number;
  available: number;
  ordered: number;
  picked: number;
  remainder: number;
}

/** GET /api/projects/:projectNo payload (SVC-042). */
export interface ProjectView {
  header: SaleHeader | null;
  refreshedAt: string;
  flooring: ProjectItemRow[];
  additional: ProjectItemRow[];
  totals: { flooring: ProjectTotals; additional: ProjectTotals };
  status: { flooringReady: boolean; additionalReady: boolean };
}

/** GET /api/status payload (SVC-032). */
export interface StatusResponse {
  refreshedAt: string;
  lastAttemptAt: string;
  healthy: boolean;
  consecutiveFailures: number;
  refreshSeconds: number;
  sources: Record<SourceKey, SourceOutcome>;
  history: RefreshHistoryEntry[];
}

export interface RefreshHistoryEntry {
  at: string;
  ok: boolean;
  durationMs: number;
  rowCounts: Record<SourceKey, number>;
}

/** The 8 satellites (ASM-008), code ↔ name 1:1 in the replica. */
export const SATELLITES: LocationOption[] = [
  { code: 'CHA', name: 'Charlotte' },
  { code: 'DET', name: 'Detroit' },
  { code: 'CIN', name: 'Cincinnati' },
  { code: 'CHI', name: 'Chicago' },
  { code: 'COL', name: 'Columbus' },
  { code: 'GRR', name: 'Grand Rapids' },
  { code: 'CLE', name: 'Cleveland' },
  { code: 'IND', name: 'Indianapolis' },
];

export const ITEM_CATEGORIES = [
  'FLOORING',
  'MOLDING',
  'TRANSITIONS',
  'ADHESIVES / SEALANTS',
  'OTHER',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
