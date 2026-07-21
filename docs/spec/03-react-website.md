# SPEC 03 — React Inventory Website

The UI layer (architecture layer 3). React 18 + Vite, **TypeScript (TSX)**, port
**5173** dev. Must visually match the two Power BI screenshots and the brand
palette (screenshot 3).

> **PB-007 resolution — language standardized on TypeScript across all three
> workspaces** (`mock-bc-api`, `inventory-service`, `inventory-web`). v1.0 Spec 03
> said "JavaScript (JSX)" while `docs/build-plan.md` said TypeScript — that
> contradiction is resolved in favour of TypeScript, because PB-001 flags the
> consolidation formula and its config as the highest-risk code; a shared typed
> `ConsolidatedItem` / `AvailabilityConfig` contract compiled across service and
> web is the cheapest guard against those shapes drifting. Specs 01/02 (which
> only said "Node 18+/Express") inherit this decision.

---

## 1. Global shell & rules

| ID | Pri | Requirement |
|---|---|---|
| WEB-001 | M | Single-page app; views: **Satellites**, **Projects**, **Inventory Status** (per ASM-007 = Both: a shortage board as the primary Inventory Status screen, with a service-health widget on it). |
| WEB-002 | M | Layout mirrors Power BI: fixed left sidebar (menu + context panels) and main content area. Responsive: sidebar collapses under 900 px width. |
| WEB-003 | M | All data via the Inventory Service `/api/*` only (Vite dev proxy locally; service URL via env in Azure). The middleware URL/credential never reaches the browser. |
| WEB-004 | M | Header: title **"Inventory Dashboard"**, divider, subtitle "Analytics & Project Search"; right side: refresh icon + current date/time. |
| WEB-005 | M | **Last Updated** display: `refreshedAt` from every API envelope, rendered in header area; auto-refreshed by polling `/api/status` every 15 s. Stale badge (gold) when `refreshedAt` older than 2× refresh interval. |
| WEB-006 | M | **Refresh icon = cache-only reload (reviewer decision 2026-07-21, PB-007).** Clicking the header refresh icon **re-reads the current cached snapshot** via the normal `/api/*` reads and refreshes on-screen data — it does **not** trigger a source pull and does **not** advance `refreshedAt` / "Last Updated" (that timestamp only moves when SVC-010 completes a cycle). The icon therefore does **not** call `POST /api/admin/refresh`; that admin endpoint (SVC-015) remains for operational/manual use but is not wired to this UI control. |
| WEB-007 | M | Menu entries: Satellites, Projects, **Item Details (visible, disabled/greyed** per ASM-006), Inventory Status. Active entry highlighted (blue accent, as screenshot). |
| WEB-008 | M | Auth: dev-stub gate locally (name entry, session only); Entra ID slot on Azure (DEC-002). Architecturally: nothing renders before the auth gate passes. |
| WEB-009 | — | **RBAC deferred (PB-007):** the docx names Project Coordinators, Regional Managers, and Operations as users but is **silent on role-based differences** in what each sees. v1 grants every authenticated user the same read-only view. Per-role scoping (e.g. satellite-restricted views) is explicitly **deferred** pending a PO requirement — recorded here so its absence is a documented decision, not an oversight. |

## 2. Theme (screenshot 3 — marketing palette)

| ID | Pri | Requirement |
|---|---|---|
| WEB-010 | M | CSS custom properties, exact brand values: navy `#262262` (base), white `#FFFFFF` (text), gold `#D29B3C` (warnings/accents), blue `#30AEE4` (interactive/selected), brown `#5B381F` (available for accents). Derived darker navy shades allowed for depth (background/panel layering, as the Power BI theme does). |
| WEB-011 | M | Dark theme only (matches "Match current dark theme"). |
| WEB-012 | M | Status colors: green (ok), yellow/amber (attention), red (short) as cell backgrounds with dark text — Power BI conditional-formatting look. |
| WEB-013 | S | Typography: clean sans-serif (system stack); tabular numerals in data grids. |
| WEB-014 | M | "Preserve familiar workflow": same navigation concepts, same panel placement, same column orders as the screenshots — no re-imagining. |

## 3. Satellite screen (screenshot 1)

| ID | Pri | Requirement |
|---|---|---|
| WEB-020 | M | Sidebar **Inventory Filters** panel: Satellite dropdown (blue accent, e.g. "Detroit"), Item Category dropdown ("All" default), Item dropdown/search ("All" default), **Clear filters** action. |
| WEB-021 | M | Main area titled **"All Inventory Items"**. |
| WEB-022 | M | Grid grouped by **Item Category** (collapsible group header rows, e.g. "FLOORING"). |
| WEB-023 | M | Columns in order: **Item Category** (group), **Item**, **On Hand**, **Allocated**, **Available**, **Available (ft²)**, **Ordered** — exactly the screenshot's columns. |
| WEB-024 | M | **Available** and **Available (ft²)** cells conditionally colored via the row's `status` (green/yellow/red per ASM-002). |
| WEB-025 | M | Numbers right-aligned, 2-decimal formatting for ft², thousands separators. |
| WEB-026 | M | Filters call `/api/inventory` server-side (no client-side-only filtering of a full dump). |
| WEB-027 | M | Search box (item no or description) wired to the `search` param. |
| WEB-028 | S | Column sort on any numeric column. |
| WEB-029 | S | Grid virtualization if row count > 500 (large-dataset requirement). |
| WEB-030 | C | Ordered cell hover: tooltip with PO number + `nextReceiptDate`. |

## 4. Project screen (screenshot 2)

| ID | Pri | Requirement |
|---|---|---|
| WEB-040 | M | Sidebar **Sale Selection** panel: project dropdown (blue accent) + read-only fields **Sale #, Satellite, Customer, BC Status, File Status, Install Date** (Install Date in red, as screenshot). |
| WEB-041 | M | Sidebar **Inventory Status** panel: rows "Flooring Materials" and "Additional Materials", each with status dot — green = ready, yellow = attention (from `status` of SVC-042). |
| WEB-042 | M | **Warning callout** (gold background `#D29B3C`, dark text): shown when additional materials not ready — "Additional materials are not available. Verify delivery before proceeding." Equivalent message for flooring shortfall. Hidden when all green. |
| WEB-043 | M | Main area section **"Flooring"** with caption: *"Unless approved by a Project Coordination Manager, please do not schedule this project if a green check box is not present on all listed flooring items."* |
| WEB-044 | M | Main area section **"Additional Materials"** with caption: *"Please ensure missing materials will be delivered prior to the Installation Completion Date so as not to impact the installation time frame."* |
| WEB-045 | M | Both tables, columns in order: **Product**, **Item Category**, **Required**, **Available**, **Ordered**, **Picked**, **Remainder**, **Item Status**. |
| WEB-046 | M | Cell coloring: Available green when ≥ required / red when short; Remainder red when > 0; per screenshot. |
| WEB-047 | M | **Item Status** column: green check icon (ready) / yellow-warning (covered by PO) / red (short) per ASM-003. |
| WEB-048 | M | **Total** row per table (sums of numeric columns, bold). |
| WEB-049 | M | Picked always renders `0.00` (ASM-004) — column present for layout fidelity. |
| WEB-050 | S | Project switcher searchable by Sale #, PRJ number, or customer name. |

## 5. Inventory Status screen (ASM-007 — ✅ DECIDED = Both)

> **Reviewer decision 2026-07-21** ([`decisions-log.md`](decisions-log.md)):
> Inventory Status = **both** an operational **shortage board** (primary) and a
> **service health / refresh widget** (secondary). This supersedes the earlier
> health-page-only working assumption (PB-004). Thresholds that drive "below
> threshold" on the board still follow **ASM-002 (🔶 OPEN / configurable)**.

| ID | Pri | Requirement |
|---|---|---|
| WEB-060 | M | **Shortage board (primary):** cross-satellite view of items (and optionally projects) whose row `status` is yellow or red per ASM-002, built from `/api/inventory` (same consolidator data as Satellites — no separate middleware calls). Columns at minimum: Satellite/location, Item, On Hand, Allocated, Available, Available (ft²), Ordered, status. Filters: satellite, category, search. Empty state when nothing is below threshold. |
| WEB-061 | M | **Health widget (secondary):** compact panel on the same Inventory Status page rendering `/api/status` — overall health, last successful refresh (`refreshedAt`), last attempt, consecutive failures, per-source ok/failed + row counts. Full 20-cycle history may be behind an expand/collapse. |
| WEB-062 | M | Failure states visually loud on the health widget: red banner when `healthy: false`; gold stale badge when `refreshedAt` older than 2× refresh interval (ties to WEB-005). |
| WEB-063 | S | Current `refreshSeconds` shown on the health widget, with admin control to change it (drives SVC-011, protected per SVC-045). |

## 6. Acceptance criteria (Stage 3 checkpoint)

- [ ] Side-by-side vs screenshot 1: same sidebar structure, same 5 data columns, grouped FLOORING block, colored availability cells.
- [ ] Side-by-side vs screenshot 2: sale panel fields, two captioned tables with all 8 columns, totals, status icons, gold callout on the MOCK-045(e) project.
- [ ] Palette audit: computed styles use the exact 5 brand hexes (+ approved derived navy shades) — no stray colors.
- [ ] Filter → network audit: every filter action hits `/api/inventory`; no `/BC/*` request ever appears in the browser network tab.
- [ ] Responsive check at 1440 px, 1024 px, 800 px.
- [ ] Header refresh icon (WEB-006): re-reads `/api/*` only — network tab shows no `POST /api/admin/refresh`; `refreshedAt` is unchanged unless a timer cycle completed.
- [ ] Inventory Status: shortage board lists yellow/red rows from `/api/inventory`; health widget shows `/api/status` on the same page (WEB-060…063).
