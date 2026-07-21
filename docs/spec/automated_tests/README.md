# Automated Test Cases

Machine-run tests for the Inventory Availability Flash replica. These run under
**Vitest** via `npm test` at the repo root (TEST-001) and must all be green
before any stage checkpoint is signed off (SPEC 05 §5).

Source of truth: [`../05-testing-acceptance.md`](../05-testing-acceptance.md).
Every case below traces to a requirement ID in specs 01–04 and to the reviewer
decisions in [`../decisions-log.md`](../decisions-log.md).

---

## Files

| File | Group | Cases | Primary target |
|---|---|---|---|
| [TC-AUTO-dev-baseline.md](TC-AUTO-dev-baseline.md) | Developer experience | TEST-001, TEST-002 | repo scripts / fresh clone |
| [TC-AUTO-unit-service.md](TC-AUTO-unit-service.md) | Unit (the math) | TEST-010 … TEST-018 | `inventory-service` |
| [TC-AUTO-contract-mock.md](TC-AUTO-contract-mock.md) | Contract (shape fidelity) | TEST-020 … TEST-024 | `mock-bc-api` |

## Conventions

- **ID** — reused from SPEC 05 where one exists; new sub-cases use a `.n` suffix
  (e.g. TEST-010.2). One assertion cluster per case.
- **Traces** — the requirement / ASM the case proves. A case with no requirement
  behind it should not exist.
- **Config-driven guardrail (PB-001):** any test that touches availability,
  thresholds, or project status **must** assert against a supplied
  `AvailabilityConfig`, never a hard-coded literal — see TEST-016. This is the
  single most important rule in this folder.
- **Determinism:** contract/data tests seed the mock with `MOCK_SEED=42`
  (MOCK-004) so runs are reproducible.

## Definition of green

- All **M**-priority cases pass.
- `npm test` exits 0 on a fresh clone with only Node 18+ (TEST-002).
- No credential from the source docs appears in the repo (MOCK-005) — asserted by
  the grep case TEST-024.5 and re-checked in the manual Definition of Done.

**Should / Could** requirements (e.g. WEB-028/029/030, MOCK-072, AZ-050/051,
SVC-004 tooltip data) are **intentionally out of Must scope** — see the coverage
note in [TC-AUTO-unit-service.md](TC-AUTO-unit-service.md). They do not block
`npm test` green or stage sign-off unless promoted.
