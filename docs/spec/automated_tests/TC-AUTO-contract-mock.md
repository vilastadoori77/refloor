# Automated — Contract Tests (mock ↔ real shape fidelity)

Traces: TEST-020 … TEST-024 · SPEC 01 (MOCK-002/010–013, 044, 045) · SPEC 00 §4.
Target: `mock-bc-api`. These are the guard that the replica's data shapes match
the `API_React Inventory Website Requirements.docx` samples field-for-field, so a
future swap to real `dev.myx.ac` (SVC-043) does not surprise the service.
Runner: Vitest, mock seeded `MOCK_SEED=42`.

---

## TEST-020 — JSON-schema validation of all four /BC/* responses

| Field | Value |
|---|---|
| **Traces** | MOCK-002, MOCK-010, MOCK-011, MOCK-012, MOCK-013 |
| **Priority** | Must |

**Setup:** transcribe schemas from the docx samples (field names, casing, types) into fixture JSON schemas.

**Cases**
| # | Endpoint | Asserts |
|---|---|---|
| 020.1 | `GET /BC/GetInventory` | each row has `no, description, i360Id, sqftPerCase, linearFtPerUnit, itemCategoryCode, locationCode, locationName, qoh`; types per MOCK-010; `qoh ≥ 0` |
| 020.2 | `GET /BC/GetPurchaseOrders` | MOCK-010 fields minus `qoh`, **plus** `qpo, sfdcSoNo, purchNo, expected_Receipt_Date`; **casing of `expected_Receipt_Date` exact**; date is `YYYY-MM-DD` |
| 020.3 | `GET /BC/Demand` | `no, description, qoh, onPO, demand, netInventory, locationName, locationCode, itemKey, projectName`; `projectName` matches `"Vinyl Flooring : {Last}, {First}"` |
| 020.4 | `GET /BC/GetInventoryByProject/:projectNo` | `{ projectNo, items: [...] }`; item `itemKey` matches `IN-xxxxxx-<LOC>` |
| 020.5 | `GET /BC/GetInventoryByProject/UNKNOWN` | `404 { error: "project not found" }` (MOCK-013) |

**Expected:** all responses validate against the transcribed schemas; any field-name or casing drift fails the suite loudly (this is the schema-drift alarm).

---

## TEST-021 — Determinism (same seed → deep-equal dataset)

| Field | Value |
|---|---|
| **Traces** | MOCK-004 |
| **Priority** | Must |

**Steps**
1. Boot two mock instances with `MOCK_SEED=42`.
2. Fetch all four endpoints from each.
3. Deep-equal the two payloads.

**Expected:** byte-for-byte identical datasets. A different seed produces a different but internally-consistent dataset (spot-checked with `MOCK_SEED=7`).

---

## TEST-022 — Demand ≡ union of all project items (consistency)

| Field | Value |
|---|---|
| **Traces** | MOCK-044, MOCK-012 |
| **Priority** | Must |

**Steps**
1. Fetch `GET /BC/Demand`.
2. Fetch `GET /BC/GetInventoryByProject/:projectNo` for **every** project (list via MOCK-060 `_mock/GetProjects`).
3. Flatten all project items and compare to the Demand rows.

**Expected:** the Demand endpoint is exactly the flattened union of per-project items — no demand row without a project, no project item missing from demand. Quantities reconcile.

---

## TEST-023 — All six MOCK-045 edge cases present

| Field | Value |
|---|---|
| **Traces** | MOCK-045(a–f) |
| **Priority** | Must |

**Cases (query the default-seed dataset, assert count ≥ mandated minimum)**
| # | Edge case | Assertion |
|---|---|---|
| 023.a | Negative `netInventory` | ≥ 3 item+location rows with `netInventory < 0` |
| 023.b | Null `locationCode` | ≥ 2 demand rows with `locationCode === null` |
| 023.c | Name/code mismatch | ≥ 1 row mimicking "Grand Rapids"/`DET` |
| 023.d | Fully-ready project | ≥ 1 project all-green (drives TEST-013.1 / WEB happy path) |
| 023.e | Flooring-ready / additional-short project | ≥ 1 (drives the gold warning callout WEB-042) |
| 023.f | qoh 0, demand > 0, PO covers | ≥ 1 item (drives Attention status TEST-013.2) |

**Expected:** every mandated edge case is demonstrably in the seed-42 data. These rows are the fixtures the manual UI drills (TEST-032/034) depend on, so their presence is asserted automatically.

---

## TEST-024 — netInventory identity holds for every Demand row

| Field | Value |
|---|---|
| **Traces** | MOCK-012 |
| **Priority** | Must |

**Steps**
1. Fetch `GET /BC/Demand`.
2. For every row assert `netInventory === qoh + onPO − demand`.

**Expected:** identity holds for all rows (0 violations). This is the invariant the ASM-001-alternative formula (`qoh + onPO − demand`) relies on in TEST-016.

---

## TEST-024.2 — Outage switch flips status codes live

| Field | Value |
|---|---|
| **Traces** | MOCK-070, MOCK-071 |
| **Priority** | Must |

**Steps**
1. `POST /admin/outage {"enabled": true, "endpoints": ["inventory"]}`.
2. `GET /BC/GetInventory` → expect `500 { error: "simulated outage" }`; `GET /BC/Demand` → still `200`.
3. `GET /admin/outage` → reflects enabled state.
4. `POST /admin/outage {"enabled": false}` → `GET /BC/GetInventory` back to `200`.

**Expected:** targeted outage toggles per-endpoint between 200 and 500; omitted `endpoints` targets all. (Backs the manual outage drills TEST-030 / TEST-035.)

---

## TEST-024.3 — Auth path segment accepted and ignored

| Field | Value |
|---|---|
| **Traces** | MOCK-003 |
| **Priority** | Should |

**Steps**
1. Call `/BC/GetInventory` with a `refloor_auth=…` path segment and an `instance=sandbox` query param.
2. Call it without them.

**Expected:** both return the same 200 payload — the credential-shaped input is accepted and ignored (mimics real URL format without validating a credential).

---

## TEST-024.4 — Mock-only marker present

| Field | Value |
|---|---|
| **Traces** | MOCK-060, MOCK-061 |
| **Priority** | Should |

**Expected**
- `GET /BC/_mock/GetProjects` returns sale headers with `{ projectNo, saleNo, customer, satelliteCode, satelliteName, bcStatus, fileStatus, installDate }`.
- Path is under `_mock/` (non-canonical marker per ASM-005 / SVC-043).
- `X-Mock-Api: true` header present on responses (MOCK-061).

---

## TEST-024.5 — No source credential in repo (grep guard) ⭐

| Field | Value |
|---|---|
| **Traces** | MOCK-005, SPEC 05 §5 DoD |
| **Priority** | Must |

**Steps**
1. Grep the whole repo for the docx's `refloor_auth` token value and any known secret strings.

**Expected:** **zero matches** outside documentation that quotes the field *name* only. Fails the build if a real credential is ever committed. (Mirrored in the manual Definition of Done.)
