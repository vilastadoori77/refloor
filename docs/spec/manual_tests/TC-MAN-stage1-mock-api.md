# Manual — Stage 1 Checkpoint: Mock BC API

Gate: the Mock BC API is accepted before the Inventory Service is built against it.
Traces: SPEC 01 §6 acceptance criteria. Automated backing:
[TC-AUTO-contract-mock.md](../automated_tests/TC-AUTO-contract-mock.md).

**Preconditions:** `npm run dev` (or the mock alone) running on `:4000`, seed 42.
Tools: a REST client / `curl`, a JSON viewer.

---

## MAN-101 — Four /BC/* endpoints validate against docx samples

| Field | Value |
|---|---|
| **Traces** | MOCK-002/010–013, SPEC 01 §6 bullet 1 |
| **Priority** | Must |

**Steps**
1. `GET /BC/GetInventory`, `/BC/GetPurchaseOrders`, `/BC/Demand`, `/BC/GetInventoryByProject/<a real projectNo>`.
2. Eyeball each payload against the docx sample: field names, casing (`expected_Receipt_Date`), value shapes.

**Expected:** all four match field-for-field; nothing extra, nothing renamed.
**Result:** ☐ Pass ☐ Fail — date/tester/evidence: ____

---

## MAN-102 — Same seed → identical dataset across restarts

| Field | Value |
|---|---|
| **Traces** | MOCK-004, SPEC 01 §6 bullet 2 |
| **Priority** | Must |

**Steps**
1. Capture `GET /BC/GetInventory` output.
2. Restart the mock (`MOCK_SEED=42`).
3. Capture again and diff.

**Expected:** no diff. (Automated TEST-021 also proves this; this is the reviewer's eyes-on confirmation.)
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-103 — All six MOCK-045 edge cases demonstrably present

| Field | Value |
|---|---|
| **Traces** | MOCK-045(a–f), SPEC 01 §6 bullet 3 |
| **Priority** | Must |

**Provided test queries**
| Edge | How to see it |
|---|---|
| (a) negative netInventory | filter `/BC/Demand` for `netInventory < 0` → ≥ 3 rows |
| (b) null locationCode | filter `/BC/Demand` for `locationCode == null` → ≥ 2 rows |
| (c) name/code mismatch | find the "Grand Rapids"/`DET` row |
| (d) fully-ready project | open the all-green project's `/BC/GetInventoryByProject` |
| (e) flooring-ready/additional-short project | open that project — additional items short |
| (f) qoh 0 + demand + covering PO | find the item; cross-check an open PO in `/BC/GetPurchaseOrders` |

**Expected:** each is findable; note the concrete IDs (they become fixtures for Stage 3/4 UI drills).
**Result:** ☐ Pass ☐ Fail — IDs recorded: ____

---

## MAN-104 — Outage switch flips endpoints 200 ↔ 500 live

| Field | Value |
|---|---|
| **Traces** | MOCK-070/071, SPEC 01 §6 bullet 4 |
| **Priority** | Must |

**Steps**
1. `POST /admin/outage {"enabled": true, "endpoints": ["inventory"]}`.
2. `GET /BC/GetInventory` → 500; `GET /BC/Demand` → 200.
3. `GET /admin/outage` reflects state.
4. `POST /admin/outage {"enabled": false}` → all back to 200.

**Expected:** targeted toggling works; omitting `endpoints` targets all.
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-105 — Demand reconciles with per-project items

| Field | Value |
|---|---|
| **Traces** | MOCK-044, SPEC 01 §6 bullet 5 |
| **Priority** | Must |

**Steps**
1. List projects via `GET /BC/_mock/GetProjects`.
2. Sum items across all `GetInventoryByProject` responses.
3. Compare to `GET /BC/Demand`.

**Expected:** Demand = flattened union of project items; quantities reconcile. (Automated TEST-022 mirrors this.)
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-106 — Mock markers & credential hygiene

| Field | Value |
|---|---|
| **Traces** | MOCK-005, MOCK-060/061 |
| **Priority** | Must |

**Steps**
1. Confirm `X-Mock-Api: true` header on responses.
2. Confirm sale headers live under `/BC/_mock/GetProjects` (non-canonical path).
3. Grep the repo — no source credential anywhere (mirrors TEST-024.5).

**Expected:** replica is clearly marked non-real; no secret committed.
**Result:** ☐ Pass ☐ Fail — ____

---

### Stage 1 sign-off

☐ All Must cases pass · Reviewer: ______ · Date: ______ · Deviations logged in CHANGELOG: ______
