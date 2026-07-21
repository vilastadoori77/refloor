# SPEC 02 — Inventory Service

The real backend from the requirements doc (architecture layers 4–5:
Service + Cache + Refresh Job). Node 18+ / Express / port **4100**.

---

## 1. Data retrieval & consolidation

| ID | Pri | Requirement |
|---|---|---|
| SVC-001 | M | On each refresh cycle, retrieve the **three cacheable feeds**: `GetInventory`, `GetPurchaseOrders`, `Demand` from the middleware base URL (env `BC_BASE_URL`, default `http://localhost:4000`). |
| SVC-001a | M | **Project inventory (`GetInventoryByProject`) design decision — intentional (PB-003):** the docx lists "Retrieve project inventory" among service responsibilities, but this feed is **per-project and parameterized** (`/:projectNo`), so it is fetched **on-demand** (SVC-042), not bulk-pulled every cycle. Consequences that MUST be handled, not left implicit: (a) a project fetch is **not** covered by the snapshot's atomic-swap/last-good guarantees (SVC-021/014); (b) project-view "Available/Ordered" numbers are joined against the **current cached snapshot**, while `required`/`demand` come from the live project fetch — so a project view is internally consistent only to the snapshot's `refreshedAt`, which MUST be shown on the project screen (WEB-040/005); (c) if the live `GetInventoryByProject` call fails, the project view returns a typed error (SVC-042a) rather than serving stale project data — there is no last-good cache per project in v1. |
| SVC-001b | S | **Optional hardening (deferred, not v1-Must):** a cached project index refreshed in the cycle, giving projects the same last-good behavior as the feeds. Listed so PB-003 has a concrete upgrade path; out of scope unless the reviewer promotes it. |
| SVC-002 | M | Consolidate the three feeds into one dataset keyed by **item + location**: `onHand = qoh` · `ordered = Σ qpo` · `allocated = Σ demand` · `available = onHand − allocated` · `availableSqft = available × sqftPerCase`. **Uses ASM-001 (✅ DECIDED reviewer 2026-07-21 — see `decisions-log.md`); PO ratification still advisable.** Implemented as a **named strategy** read from config — the formula is NOT hard-coded (guardrail: SPEC 00 §5); the `qoh + onPO − demand` alternative remains a config switch. |
| SVC-003 | M | Classify each row `green/yellow/red` per **ASM-002 (🔶 OPEN, configurable)**; thresholds read from config, changeable at runtime (SVC-011 mechanism). No threshold value is hard-coded. |
| SVC-004 | M | Attach `nextReceiptDate` = earliest `expected_Receipt_Date` among open POs for that item+location. |
| SVC-005 | M | Rows with `locationCode: null` are consolidated under a synthetic `"UNK"` location (never dropped, never crash) — handles MOCK-045(b). |
| SVC-006 | M | Per-feed HTTP timeout 10 s; feed failure does not abort the other feeds' retrieval. |

## 2. Refresh job (docx "Cache Refresh" must-haves)

| ID | Pri | Requirement |
|---|---|---|
| SVC-010 | M | Scheduled refresh every `REFRESH_SECONDS` (default **300** per spec; local `.env` sets 60 per ASM-009). |
| SVC-011 | M | Interval changeable **at runtime without deployment**: `PUT /api/admin/config {"refreshSeconds": n}` takes effect from the next cycle. Same endpoint accepts threshold overrides (SVC-003). |
| SVC-012 | M | **Retry logic:** failed feed retried up to 3× with exponential backoff (1 s, 2 s, 4 s) within the cycle. |
| SVC-013 | M | **Refresh logging:** every cycle logs start, per-feed outcome, row counts, duration, success/failure. |
| SVC-014 | M | **Last successful cache retained:** if any feed still fails after retries, the cycle is marked failed and the previous snapshot continues to be served unchanged, including its original `refreshedAt`. |
| SVC-015 | M | `POST /api/admin/refresh` triggers an immediate out-of-band cycle (backs the UI refresh icon). |

## 3. Cache (docx "Cache Storage" must-haves)

| ID | Pri | Requirement |
|---|---|---|
| SVC-020 | M | Cache abstracted behind a store interface with two implementations: **in-memory** (default, local + Azure free tier) and **Redis** (`CACHE_DRIVER=redis`, `REDIS_URL`). Docx preferred Redis; the SQL Server alternative is a **deliberate omission** (SPEC 00 §4) — not implemented in v1; the store interface keeps a SQL driver addable later. Driver selection is config-only (DEC-001). |
| SVC-021 | M | **Atomic updates:** a cycle builds a complete new snapshot object and swaps it in a single reference/`SET` operation. Readers can never observe a partial refresh. |
| SVC-022 | M | **Cached timestamp:** snapshot carries `refreshedAt` (ISO-8601); every API response envelope includes it. |
| SVC-023 | M | Snapshot also records per-feed status (`ok`/`failed`) and source row counts, for the health page. |

## 4. Health & monitoring (docx "API Health" must-haves)

| ID | Pri | Requirement |
|---|---|---|
| SVC-030 | M | **Logging:** structured (JSON lines) with level, timestamp, event, detail. |
| SVC-031 | M | **Alerts:** pluggable alert sink fired on refresh failure and on recovery; console locally, Azure Monitor→email in cloud (ASM-010, AZ-041). Consecutive-failure count included. |
| SVC-032 | M | **Dashboard status:** `GET /api/status` → `{ refreshedAt, lastAttemptAt, healthy, consecutiveFailures, refreshSeconds, sources: {inventory, purchaseOrders, demand → ok/failed + rowCount}, history: last 20 cycles }`. |
| SVC-033 | M | `GET /healthz` liveness probe (200 + uptime) for App Service health checks. |
| SVC-034 | S | Optional Application Insights wiring via `APPLICATIONINSIGHTS_CONNECTION_STRING` (no-op locally). |

## 5. Internal API for the website

All responses use envelope `{ refreshedAt, data }`. CORS restricted to the website origin (env `WEB_ORIGIN`).

| ID | Pri | Endpoint & behavior |
|---|---|---|
| SVC-040 | M | `GET /api/inventory?location&category&search` — consolidated rows; filters: exact `location` code, exact `category`, case-insensitive `search` over item no + description. Sorted by category, then description. |
| SVC-041 | M | `GET /api/locations` and `GET /api/categories` — distinct values for filter dropdowns. |
| SVC-042 | M | `GET /api/projects` — sale-header list (proxied from MOCK-060, **replica-only source** — see SVC-043). `GET /api/projects/:projectNo` — combines sale header + live `GetInventoryByProject` + current snapshot into: `{ header, refreshedAt, flooring: [], additional: [], totals, status: { flooringReady, additionalReady } }`, where each item row = `{ product, itemCategory, required, available, ordered, picked: 0 (ASM-004), remainder, itemStatus }` (itemStatus per **ASM-003, 🔶 OPEN/configurable**), split flooring vs additional by `itemCategoryCode === "FLOORING"`. |
| SVC-042a | M | **Project-fetch failure behavior (PB-003):** if the live `GetInventoryByProject` call fails/times out, return `503 { error: "project source unavailable" }` — the service does **not** serve stale per-project data (no per-project last-good cache in v1). The satellite views and their snapshot are unaffected. |
| SVC-043 | M | **Config-swap readiness — scoped honestly (PB-002).** The three cacheable **feeds** (`GetInventory`, `GetPurchaseOrders`, `Demand`) and the per-project fetch are swap-ready: base URL + auth come only from env/Key Vault (`BC_BASE_URL`, `BC_AUTH_TOKEN` — unused by the mock, inserted into the request path/headers when set), so repointing them at the real `dev.myx.ac` is config-only. **This is NOT true for the whole app:** the **sale-header endpoint (`/api/projects` list, from MOCK-060) has no real middleware equivalent** (ASM-005) and will break on a real-endpoint swap until a genuine sale-header source is identified and integrated. The prior v1.0 claim of "zero code changes to point at real middleware" is **retracted** — it holds for feeds/project-items, not for sale headers. |
| SVC-044 | M | The service never exposes `BC_BASE_URL`/`BC_AUTH_TOKEN` in any response (architecture invariant). |
| SVC-045 | M | **Admin-endpoint protection (PB-007):** the mutating admin endpoints (`PUT /api/admin/config`, `POST /api/admin/refresh`) require a shared-secret header (`X-Admin-Token`, from env/Key Vault) whenever `NODE_ENV=production` / running on Azure. Locally the check is off by default for convenience but the guard code exists so cloud deployment is not an open mutation surface. |

## 6. Acceptance criteria (Stage 2 checkpoint)

- [ ] `/api/inventory` numbers hand-verifiable against raw mock feeds for 3 sampled item+locations (default formula ASM-001).
- [ ] Formula/thresholds are read from config (proven by flipping a config value and seeing numbers/colors change with no code edit) — confirms the PB-001 guardrail.
- [ ] Runtime interval change via `PUT /api/admin/config` observed without restart.
- [ ] Outage drill: enable mock outage → next cycle fails, logs + alert fire, `/api/*` still serves previous snapshot with old `refreshedAt`, `/api/status` shows failure; disable outage → recovery within one cycle.
- [ ] Project-fetch failure returns 503 (not stale data) while satellite views keep serving (SVC-042a).
- [ ] Kill-readers-never-see-partial check: hammer `/api/inventory` during a refresh, every response internally consistent.
- [ ] Project endpoint splits flooring/additional correctly and statuses match the ASM-003 default for the MOCK-045(d)(e) projects.
- [ ] Admin endpoints reject unauthenticated mutation when the production guard is enabled (SVC-045).
