# SPEC 05 — Testing & Acceptance

How every requirement in specs 01–04 gets verified. Test IDs trace to
requirement IDs. Runner: **Vitest** (unit/contract), plus scripted end-to-end
drills run at stage checkpoints.

**Case catalogs (run these):**
- Automated (Vitest / smoke): [`automated_tests/`](automated_tests/)
- Manual stage checkpoints: [`manual_tests/`](manual_tests/)

Every TEST-ID below is expanded into concrete steps in those folders. Specs
change by review (see §6); keep the catalogs in sync when IDs change.

---

## 1. Developer experience baseline

| ID | Pri | Requirement |
|---|---|---|
| TEST-001 | M | `npm install` at repo root installs all workspaces; `npm run dev` starts mock (4000) + service (4100) + web (5173) concurrently; `npm test` runs all unit/contract suites. |
| TEST-002 | M | Fresh-clone test: the above works on a clean checkout with only Node 18+ installed (no Docker, no Azure, no global tools). |

## 2. Unit tests (inventory-service — the math that must not be wrong)

| ID | Covers | Cases |
|---|---|---|
| TEST-010 | SVC-002 / ASM-001 | Consolidation: onHand/allocated/ordered/available/availableSqft for crafted fixtures incl. multi-PO and multi-project demand on one item+location. Asserts against the **configured** formula, not a hard-coded expectation. |
| TEST-011 | SVC-003 / ASM-002 | Threshold classification: boundary values (available = −1, 0, just-under/over 25% of allocated, allocated = 0 cases). Default rule uses **strict** `<` for the yellow band — at exactly 25% of Allocated the status is **green** (see TEST-011.4 in `automated_tests/`). |
| TEST-012 | SVC-005 | Null `locationCode` → `UNK` bucket, nothing dropped. |
| TEST-013 | ASM-003 | Project item status: ready / covered-by-PO / short; remainder math. |
| TEST-014 | SVC-021 | Atomic swap: concurrent reads during swap always see a complete old or complete new snapshot (property-style test). |
| TEST-015 | SVC-012/014 | Retry then keep-last-good: simulated feed failure sequences. |
| TEST-016 | SVC-002/003 (PB-001 guardrail) | **Config-drives-math proof:** feed the consolidator two different `AvailabilityConfig` objects (default ASM-001 vs an alternative `available = qoh + onPO − demand`) and assert outputs/colors change accordingly — proving no formula/threshold is hard-coded. |
| TEST-017 | SVC-042a (PB-003) | Live project fetch failure → `/api/projects/:id` returns 503 and does **not** serve stale project data, while `/api/inventory` still serves the snapshot. |
| TEST-018 | SVC-045 (PB-007) | Admin endpoints reject mutation without `X-Admin-Token` when the production guard is enabled; accept with it. |

## 3. Contract tests (mock ↔ real shape fidelity)

| ID | Covers | Cases |
|---|---|---|
| TEST-020 | MOCK-002/010–013 | JSON-schema validation of all four `/BC/*` responses against schemas transcribed from the docx samples (field names, casing, types — incl. `expected_Receipt_Date`). |
| TEST-021 | MOCK-004 | Determinism: two servers, same seed → deep-equal datasets. |
| TEST-022 | MOCK-044 | Consistency: Demand rows ≡ union of all `GetInventoryByProject` items. |
| TEST-023 | MOCK-045 | All six mandated edge cases present in the default-seed dataset. |
| TEST-024 | MOCK-012 | `netInventory = qoh + onPO − demand` for every row. |

## 4. Stage-checkpoint drills (manual, scripted steps provided)

| ID | Stage | Drill |
|---|---|---|
| TEST-030 | 2 | **Outage drill:** curl outage on → observe failed cycle in logs, `/api/status` unhealthy, `/api/inventory` still serving with old `refreshedAt` → outage off → recovery. (SVC-014, SVC-031, MOCK-070) → `manual_tests` MAN-204 |
| TEST-031 | 2 | **Runtime config drill:** change `refreshSeconds` via API, confirm next-cycle timing without restart. (SVC-011) → MAN-203 |
| TEST-032 | 3 | **Screenshot parity review:** reviewer compares both screens against the two Power BI screenshots; discrepancies logged and fixed before sign-off. (WEB acceptance lists) → MAN-301/302 |
| TEST-033 | 3 | **Isolation audit:** browser dev-tools network capture during full click-through contains zero non-`/api` data requests. (WEB-003) → MAN-304 |
| TEST-034 | 4 | **Full local run-through:** filter satellite → find shortage item → open short project → see callout → header refresh (WEB-006 cache-only — no `POST /api/admin/refresh`) → open Inventory Status (shortage board + health widget) → kill mock mid-session → verify stale-but-served on satellite views → restore. → MAN-401 |
| TEST-035 | 5 | **Cloud repeat** of TEST-030 + TEST-034 on Azure, plus alert-email receipt and Key Vault resolution. (AZ-041, AZ-010) → **MAN-504** (outage + email) **+ MAN-508** (full TEST-034 E2E in cloud) |

## 5. Definition of Done (whole project)

- [ ] Every **M** requirement in specs 01–04 implemented and its listed acceptance criteria checked.
- [ ] All unit + contract tests green in `npm test`.
- [ ] All six drills executed with reviewer present (or evidence captured).
- [ ] No credential from the source documents anywhere in the repo (MOCK-005) — verified by grep.
- [ ] README documents: run instructions, architecture summary, how to point at real endpoints later (SVC-043), cost/teardown notes.
- [ ] Repo committed to git with the spec suite, code, tests, and deploy scripts.

## 6. Deviation rule

Any deviation from an approved spec ID during implementation is stopped,
logged in `docs/spec/CHANGELOG.md` with rationale, and brought back to the
reviewer — specs change by review, not silently in code.
