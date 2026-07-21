# Manual — Stage 2 Checkpoint: Inventory Service

Gate: the Inventory Service (consolidation + cache + refresh + health) is accepted.
Traces: SPEC 02 §6 acceptance + TEST-030 (outage drill) + TEST-031 (runtime config).
Automated backing: [TC-AUTO-unit-service.md](../automated_tests/TC-AUTO-unit-service.md).

**Preconditions:** mock (:4000) + service (:4100) running. `curl`/REST client ready.

---

## MAN-201 — /api/inventory hand-verifiable against raw feeds (ASM-001)

| Field | Value |
|---|---|
| **Traces** | SVC-002, ASM-001, SPEC 02 §6 bullet 1 |
| **Priority** | Must |

**Steps**
1. Pick 3 item+location keys.
2. Pull raw `qoh` (GetInventory), `Σ qpo` (GetPurchaseOrders), `Σ demand` (Demand) for each.
3. Compute expected `available = onHand − allocated` and `availableSqft = available × sqftPerCase`.
4. Compare to `GET /api/inventory` for those rows.

**Expected:** service numbers match the hand calc for all 3.
**Result:** ☐ Pass ☐ Fail — sampled keys: ____

---

## MAN-202 — Formula & thresholds are config-driven (PB-001 guardrail)

| Field | Value |
|---|---|
| **Traces** | SVC-002/003, PB-001, SPEC 02 §6 bullet 2 |
| **Priority** | Must |

**Steps**
1. Note current `available`/color for a sample row.
2. Change the availability strategy to `qoh + onPO − demand` and/or a threshold via config (`PUT /api/admin/config` or config file per implementation).
3. Re-read `/api/inventory`.

**Expected:** numbers and/or colors change **with no code edit / no redeploy**. Restore config afterward. (Automated TEST-016 is the assertion; this is the live demonstration.)
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-203 — Runtime interval change without restart

| Field | Value |
|---|---|
| **Traces** | SVC-011, TEST-031, SPEC 02 §6 bullet 3 |
| **Priority** | Must |

**Steps**
1. Observe refresh cadence in logs (default local 60 s).
2. `PUT /api/admin/config {"refreshSeconds": 15}`.
3. Watch the next cycles.

**Expected:** cadence changes from the next cycle, **no process restart**.
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-204 — Outage drill: keep serving last-good (TEST-030)

| Field | Value |
|---|---|
| **Traces** | SVC-014, SVC-031, MOCK-070, TEST-030, SPEC 02 §6 bullet 4 |
| **Priority** | Must |

**Steps**
1. Note current `refreshedAt` from `/api/status`.
2. Enable mock outage (`POST /admin/outage {"enabled": true}`).
3. Wait for the next refresh cycle.
4. Check logs, `/api/status`, and `/api/inventory`.
5. Disable outage; wait one cycle.

**Expected**
- Failed cycle logged; alert sink fires; `consecutiveFailures` increments.
- `/api/status` shows unhealthy / per-source failed.
- `/api/inventory` **still serves the previous snapshot with the OLD `refreshedAt`** (last-good).
- After outage off, recovery within one cycle; `refreshedAt` advances.

**Result:** ☐ Pass ☐ Fail — old/new refreshedAt: ____

---

## MAN-205 — Project-fetch failure returns 503, not stale (TEST-017 live)

| Field | Value |
|---|---|
| **Traces** | SVC-042a, PB-003, SPEC 02 §6 bullet 5 |
| **Priority** | Must |

**Steps**
1. Enable outage on the `project` endpoint only (`POST /admin/outage {"enabled": true, "endpoints": ["project"]}`).
2. `GET /api/projects/:projectNo`.
3. `GET /api/inventory` alongside.

**Expected:** project call returns `503 { error: "project source unavailable" }` — **no stale project data**; satellite views keep serving. Disable outage after.
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-206 — Readers never see a partial refresh

| Field | Value |
|---|---|
| **Traces** | SVC-021, SPEC 02 §6 bullet 6 |
| **Priority** | Must |

**Steps**
1. Hammer `GET /api/inventory` in a loop during an active refresh cycle (e.g. `while true; do curl -s .../api/inventory | jq '.refreshedAt'; done`).

**Expected:** every response is internally consistent — `refreshedAt` flips atomically from old to new; no response with mismatched/partial item data. (TEST-014 is the property-test backing.)
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-207 — Project endpoint splits flooring/additional + ASM-003 statuses

| Field | Value |
|---|---|
| **Traces** | SVC-042, ASM-003, MOCK-045(d)(e), SPEC 02 §6 bullet 7 |
| **Priority** | Must |

**Steps**
1. `GET /api/projects/<all-green project>` (MOCK-045d).
2. `GET /api/projects/<flooring-ready/additional-short project>` (MOCK-045e).

**Expected:** items split by `itemCategoryCode === "FLOORING"` into `flooring`/`additional`; `itemStatus` and `status.flooringReady/additionalReady` match the ASM-003 default; the (e) project shows additional-short (drives the Stage-3 gold callout).
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-208 — Admin endpoints reject unauthenticated mutation (guard on)

| Field | Value |
|---|---|
| **Traces** | SVC-045, PB-007, SPEC 02 §6 bullet 8 |
| **Priority** | Must |

**Steps**
1. Run the service with the production guard enabled.
2. `PUT /api/admin/config` and `POST /api/admin/refresh` **without** `X-Admin-Token`.
3. Retry **with** the token.

**Expected:** rejected (401/403) without token; accepted with it. (Automated TEST-018.)
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-209 — Invariant: no middleware URL/credential leaks to any /api response

| Field | Value |
|---|---|
| **Traces** | SVC-044, SPEC 00 §3 invariant |
| **Priority** | Must |

**Steps**
1. Scan every `/api/*` response body/headers for `BC_BASE_URL`, `BC_AUTH_TOKEN`, or the mock host.

**Expected:** never present — the service is the only thing that knows the middleware.
**Result:** ☐ Pass ☐ Fail — ____

---

### Stage 2 sign-off

☐ All Must cases pass · Reviewer: ______ · Date: ______ · Deviations logged: ______
