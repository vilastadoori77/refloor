# Manual — Stage 3 Checkpoint: React Website

Gate: the React website is accepted against the two Power BI screenshots + brand palette.
Traces: SPEC 03 §6 acceptance + TEST-032 (screenshot parity) + TEST-033 (isolation audit).
Reviewer decisions in force: **ASM-007 = Both**, **WEB-006 = cache-only**.

**Preconditions:** full stack up (`npm run dev`); browser with dev-tools; the two
docx screenshots + screenshot 3 (palette) open for side-by-side.

---

## MAN-301 — Satellite screen parity (screenshot 1)

| Field | Value |
|---|---|
| **Traces** | WEB-020…030, TEST-032, SPEC 03 §6 bullet 1 |
| **Priority** | Must |

**Steps**
1. Open Satellites; select a satellite (e.g. Detroit).
2. Compare against screenshot 1.

**Expected**
- Sidebar **Inventory Filters**: Satellite / Item Category / Item dropdowns + Clear filters.
- Main title **"All Inventory Items"**; grid grouped by Item Category (FLOORING block collapsible).
- Columns in order: Item Category, Item, On Hand, Allocated, Available, Available (ft²), Ordered.
- **Available / Available (ft²)** cells colored green/yellow/red per ASM-002.
- Numbers right-aligned, ft² 2-decimals, thousands separators.

**Result:** ☐ Pass ☐ Fail — screenshot attached: ____

---

## MAN-302 — Project screen parity (screenshot 2)

| Field | Value |
|---|---|
| **Traces** | WEB-040…050, TEST-032, SPEC 03 §6 bullet 2 |
| **Priority** | Must |

**Steps**
1. Open Projects; select the MOCK-045(e) project (flooring ready / additional short).

**Expected**
- **Sale Selection** panel: Sale #, Satellite, Customer, BC Status, File Status, Install Date (Install Date in red).
- **Inventory Status** panel: Flooring Materials / Additional Materials rows with status dots.
- **Gold warning callout** visible (additional not available) — hidden on an all-green project (MOCK-045d).
- Two captioned tables (Flooring, Additional Materials), columns: Product, Item Category, Required, Available, Ordered, Picked, Remainder, Item Status.
- Totals row per table; Picked renders `0.00`; Item Status icons per ASM-003.

**Result:** ☐ Pass ☐ Fail — both projects checked: ____

---

## MAN-303 — Palette audit (exact brand hexes)

| Field | Value |
|---|---|
| **Traces** | WEB-010…014, SPEC 03 §6 bullet 3 |
| **Priority** | Must |

**Steps**
1. Inspect computed styles for background, text, interactive, warning elements.

**Expected:** navy `#262262`, white `#FFFFFF`, gold `#D29B3C`, blue `#30AEE4`, brown `#5B381F` (+ approved derived navy shades only) — no stray colors. Dark theme only.
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-304 — Network isolation audit (TEST-033)

| Field | Value |
|---|---|
| **Traces** | WEB-003, TEST-033, SPEC 03 §6 bullet 4 |
| **Priority** | Must |

**Steps**
1. Open dev-tools Network; clear.
2. Click through both screens, all filters, project switching.

**Expected:** **every** data request is to `/api/*`; **zero** `/BC/*` requests appear; the middleware URL/credential never appears in the browser. Save a HAR as evidence.
**Result:** ☐ Pass ☐ Fail — HAR: ____

---

## MAN-305 — Responsive check

| Field | Value |
|---|---|
| **Traces** | WEB-002, SPEC 03 §6 bullet 5 |
| **Priority** | Must |

**Steps:** view at 1440 px, 1024 px, 800 px.
**Expected:** layout holds; sidebar collapses under 900 px; no overflow/clipping.
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-306 — Refresh icon is cache-only (WEB-006 reviewer decision) ⭐

| Field | Value |
|---|---|
| **Traces** | WEB-006, decisions-log 2026-07-21, SPEC 03 §6 bullet 6 |
| **Priority** | Must |

**Steps**
1. Note current "Last Updated" value (it displays `refreshedAt` from the API envelope).
2. Open dev-tools Network; click the header refresh icon.

**Expected**
- The click **re-reads** `/api/*` and refreshes the on-screen data (filters/grids re-fetch).
- **No `POST /api/admin/refresh` request appears** in the network tab.
- The **"Last Updated" / `refreshedAt` value does not change** because of this click — it only advances when a service timer cycle completes (SVC-010). If a timer cycle happens to finish in the same moment, that is coincidental, not caused by the icon.

**This is the exact behavior v1.2 corrected — verify it explicitly.**
**Result:** ☐ Pass ☐ Fail — network capture: ____

---

## MAN-307 — Inventory Status = shortage board + health widget (ASM-007 = Both) ⭐

| Field | Value |
|---|---|
| **Traces** | WEB-060…063, ASM-007, SPEC 03 §6 bullet 7 |
| **Priority** | Must |

**Steps**
1. Open **Inventory Status**.

**Expected**
- **Shortage board (primary):** cross-satellite yellow/red rows from `/api/inventory` (columns: Satellite, Item, On Hand, Allocated, Available, Available (ft²), Ordered, status); filters satellite/category/search; empty state when nothing below threshold.
- **Health widget (secondary):** `/api/status` panel — overall health, last successful refresh, last attempt, consecutive failures, per-source ok/failed + row counts.
- Failure states loud: red banner when `healthy:false`; gold stale badge when `refreshedAt` older than 2× interval (WEB-062, ties WEB-005).
- `refreshSeconds` shown with admin control (WEB-063, protected per SVC-045).

**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-308 — Item Details menu present but disabled; auth gate

| Field | Value |
|---|---|
| **Traces** | WEB-007 (ASM-006), WEB-008 |
| **Priority** | Must |

**Expected:** menu shows Satellites, Projects, **Item Details (greyed/disabled)**, Inventory Status. Nothing renders before the dev-stub auth gate passes.
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-309 — "Last Updated" stale badge behavior

| Field | Value |
|---|---|
| **Traces** | WEB-005 |
| **Priority** | Should |

**Steps:** let a refresh fail (mock outage) until `refreshedAt` exceeds 2× interval.
**Expected:** gold stale badge appears in the header; clears on recovery. `/api/status` polled ~every 15 s.
**Result:** ☐ Pass ☐ Fail — ____

---

### Stage 3 sign-off

☐ All Must cases pass · Reviewer: ______ · Date: ______ · Discrepancies logged & fixed: ______
