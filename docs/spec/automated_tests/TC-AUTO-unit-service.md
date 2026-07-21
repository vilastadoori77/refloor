# Automated — Unit Tests (inventory-service: the math that must not be wrong)

Traces: TEST-010 … TEST-018 · SPEC 02 §1–§5 · ASM-001/002/003 · decisions-log.
Target: `inventory-service` consolidation, classification, cache, admin guard.
Runner: Vitest. **No network** — feed crafted fixtures directly to the units.

> **Guardrail (PB-001), applies to every case here:** availability, thresholds,
> and project status are read from an injected `AvailabilityConfig`. Assertions
> compute the expected value **from that same config**, never from a magic
> number. TEST-016 exists to prove the guardrail itself.

---

## TEST-010 — Consolidation math (ASM-001 default)

| Field | Value |
|---|---|
| **Traces** | SVC-002, ASM-001 (✅ DECIDED = `Available = OnHand − Allocated`) |
| **Priority** | Must |

**Fixtures**
- F-A: one item+location, `qoh=100`, two demand rows (30, 20), two open POs (`qpo` 40, 10).
- F-B: same item, two locations (split demand/PO) — proves keying by item+location.
- F-C: one item+location with multi-project demand (same item demanded by 3 projects).

**Cases**
| # | Input | Expected (from config = ASM-001) |
|---|---|---|
| 010.1 | F-A | `onHand=100`, `allocated=50`, `ordered=50`, `available=50`, `availableSqft=50×sqftPerCase` |
| 010.2 | F-B | rows keyed separately per location; no cross-location bleed |
| 010.3 | F-C | `allocated = Σ demand across all 3 projects` |
| 010.4 | ft² | `availableSqft = available × sqftPerCase`, 2-decimal rounding matches WEB-025 |

**Expected:** every field equals the value computed from the injected formula strategy; changing the strategy (see TEST-016) changes the result.

---

## TEST-011 — Threshold classification (ASM-002, 🔶 OPEN / configurable)

| Field | Value |
|---|---|
| **Traces** | SVC-003, ASM-002 |
| **Priority** | Must |

**Boundary cases (default config: red <0; yellow 0 ≤ avail < 25% allocated, min 10 when allocated=0; green otherwise)**
| # | available | allocated | Expected status |
|---|---|---|---|
| 011.1 | −1 | 40 | red |
| 011.2 | 0 | 40 | yellow |
| 011.3 | 9 | 40 | yellow (9 < 25% of 40 = 10) |
| 011.4 | 10 | 40 | **green** (rule is Available **&lt;** 25% of Allocated — 10 is not &lt; 10) |
| 011.5 | 11 | 40 | green |
| 011.6 | 9 | 0 | yellow (min-10 rule when Allocated = 0) |
| 011.7 | 10 | 0 | green (min-10 rule when Allocated = 0) |

**Expected:** classifier output matches the boundary rule as defined by the injected threshold config. Equality at the threshold is **green** under the default ASM-002 wording (`Available < 25% of Allocated`); assert `<` vs `≤` explicitly so the rule is unambiguous.

---

## TEST-012 — Null locationCode → UNK bucket

| Field | Value |
|---|---|
| **Traces** | SVC-005, MOCK-045(b) |
| **Priority** | Must |

**Steps**
1. Feed demand/inventory rows where `locationCode` is `null` for ≥ 2 rows.
2. Run consolidation.

**Expected**
- Null-location rows are consolidated under a synthetic `"UNK"` location.
- **Nothing is dropped** (row count in = row count represented out).
- No throw / no NaN in downstream math.

---

## TEST-013 — Project item status (ASM-003, 🔶 OPEN / configurable)

| Field | Value |
|---|---|
| **Traces** | SVC-042 (itemStatus), ASM-003 |
| **Priority** | Must |

**Cases (default: Ready if avail ≥ required; Attention if avail < required but avail+ordered ≥ required; Short otherwise; remainder = required − picked)**
| # | required | available | ordered | picked | Expected status | Expected remainder |
|---|---|---|---|---|---|---|
| 013.1 | 20 | 25 | 0 | 0 | Ready | 20 |
| 013.2 | 20 | 10 | 15 | 0 | Attention (PO covers) | 20 |
| 013.3 | 20 | 5 | 5 | 0 | Short | 20 |
| 013.4 | 20 | 25 | 0 | 20 | Ready | 0 (remainder = required − picked) |

**Expected:** status + remainder match the injected ASM-003 strategy. Picked is `0.00` from the mock (ASM-004) but the remainder formula still subtracts it, proving the field is wired.

---

## TEST-014 — Atomic snapshot swap (readers never see partial)

| Field | Value |
|---|---|
| **Traces** | SVC-021 |
| **Priority** | Must |
| **Type** | Property-style / concurrency |

**Steps**
1. Seed a "current" snapshot A.
2. Start N concurrent readers that repeatedly read the active snapshot.
3. Build snapshot B and perform the atomic swap while readers run.

**Expected:** every read returns a **complete** A or a **complete** B — never a mix (no field from A alongside a field from B, no partially-populated items array). Assert by tagging each snapshot with a version and checking read invariants.

---

## TEST-015 — Retry then keep-last-good

| Field | Value |
|---|---|
| **Traces** | SVC-012, SVC-014 |
| **Priority** | Must |

**Cases**
| # | Feed behavior | Expected |
|---|---|---|
| 015.1 | Fails twice then succeeds | 3 attempts with backoff (1s/2s/4s — timers faked); cycle succeeds; snapshot updated |
| 015.2 | Fails all 3 attempts | cycle marked **failed**; previous snapshot retained **unchanged**, including original `refreshedAt` |
| 015.3 | One of three feeds fails | whole cycle failed (SVC-014); no partial snapshot published |

**Expected:** backoff schedule honored; last-good served on failure; `consecutiveFailures` increments.

---

## TEST-016 — Config-drives-math proof (PB-001 guardrail) ⭐

| Field | Value |
|---|---|
| **Traces** | SVC-002, SVC-003, PB-001 guardrail (SPEC 00 §5) |
| **Priority** | Must — **this is the keystone case** |

**Steps**
1. Build one fixture set.
2. Run the consolidator with **config X** = ASM-001 default (`available = onHand − allocated`).
3. Run the same fixtures with **config Y** = alternative (`available = qoh + onPO − demand`, the `netInventory` identity) and different color thresholds.

**Expected**
- Numeric `available`/`availableSqft` **and** the `green/yellow/red` classifications **differ** between X and Y, purely from the config swap — **no source edit**.
- Proves neither the formula nor any threshold is hard-coded (enforces the SPEC 00 §5 build guardrail and backs the reviewer's ability to ratify ASM-002/003 later without a rewrite).

---

## TEST-017 — Live project-fetch failure → 503, not stale

| Field | Value |
|---|---|
| **Traces** | SVC-042a, PB-003 |
| **Priority** | Must |

**Steps**
1. Mock the `GetInventoryByProject` client to fail/time out.
2. Call the service `GET /api/projects/:projectNo` handler.
3. Concurrently call `GET /api/inventory`.

**Expected**
- Project endpoint returns `503 { error: "project source unavailable" }`.
- **No stale per-project data** is served (there is no per-project last-good cache in v1).
- `/api/inventory` still serves the current snapshot unaffected.

---

## TEST-018 — Admin endpoints reject unauthenticated mutation

| Field | Value |
|---|---|
| **Traces** | SVC-045, PB-007, AZ-011a |
| **Priority** | Must |

**Cases (production guard enabled)**
| # | Request | Expected |
|---|---|---|
| 018.1 | `PUT /api/admin/config` **without** `X-Admin-Token` | 401/403 rejected, no config change |
| 018.2 | `POST /api/admin/refresh` **without** token | 401/403 rejected, no cycle triggered |
| 018.3 | Either endpoint **with** correct token | 200, action performed |
| 018.4 | Guard **off** (local default) | mutation allowed without token (documented dev convenience) |

**Expected:** the guard exists and is enforced when `NODE_ENV=production`; local convenience path is explicit, not accidental.

---

## Coverage note

TEST-010…018 cover every **M** unit-testable rule in SPEC 02 and the ASM business
rules. WEB rendering is covered by manual screenshot-parity (TEST-032) and E2E
(TEST-034) in [`../manual_tests/`](../manual_tests/), not here — component
rendering fidelity is a human/visual check by decision, not an assertion.

**Intentionally out of Must scope (Should / Could — not blocking green):**
SVC-004 `nextReceiptDate` attachment, WEB-028/029 column sort & grid
virtualization, WEB-030 Ordered-cell PO tooltip, MOCK-040…046 catalog *size*
floors beyond the MOCK-045 edge-case presence checks, MOCK-072 reseed,
AZ-050/051 custom domain / CI. Add cases later if those priorities are promoted.
