# Manual Test Cases

Human-run acceptance checks and stage-checkpoint drills. These are the gates a
reviewer walks before signing off each stage (SPEC 05 §4–§5). They cover what
automation deliberately does not: visual screenshot parity, live outage/recovery
behavior, network-isolation audits, and end-to-end flows.

Source of truth: [`../05-testing-acceptance.md`](../05-testing-acceptance.md)
plus the per-spec "Acceptance criteria" sections. Traced to the reviewer
decisions in [`../decisions-log.md`](../decisions-log.md).

---

## Files (one per stage)

| File | Stage | Gate | Traces |
|---|---|---|---|
| [TC-MAN-stage1-mock-api.md](TC-MAN-stage1-mock-api.md) | 1 | Mock BC API accepted | SPEC 01 §6 |
| [TC-MAN-stage2-service.md](TC-MAN-stage2-service.md) | 2 | Inventory Service accepted | SPEC 02 §6, TEST-030/031 |
| [TC-MAN-stage3-web.md](TC-MAN-stage3-web.md) | 3 | React website accepted | SPEC 03 §6, TEST-032/033 |
| [TC-MAN-stage4-e2e.md](TC-MAN-stage4-e2e.md) | 4 | Full local run-through | TEST-034, DoD |
| [TC-MAN-stage5-azure.md](TC-MAN-stage5-azure.md) | 5 | Cloud deployment accepted | SPEC 04 §7, TEST-035 (MAN-504 + MAN-508) |

**Excel catalog (all cases, runnable checklist):**
[`manual-tests-catalog.xlsx`](manual-tests-catalog.xlsx) — Summary + All Cases + one sheet per stage. Use the Result / Tester / Date / Evidence columns during sign-off.

## How to run a checkpoint

1. Pre-req: all automated tests green (`npm test`) — see [`../automated_tests/`](../automated_tests/).
2. Work the drill steps in order; record **Pass / Fail** and capture the listed evidence (screenshot, network HAR, log excerpt).
3. Any failure is logged in [`../CHANGELOG.md`](../CHANGELOG.md) per the deviation rule (SPEC 05 §6) and fixed before sign-off — **specs change by review, not silently in code.**
4. A stage is "accepted" only when every **M** case passes with the reviewer present (or evidence captured).

## Result-recording template

Each case carries a **Result** row — fill `☐ Pass / ☐ Fail`, date, tester, and an
evidence link. Keep completed runs (copy the file into a dated `runs/` subfolder
if you want a history), so a checkpoint sign-off is auditable.

## Reviewer decisions in force (from decisions-log 2026-07-21)

- **ASM-001** = `Available = OnHand − Allocated` (still configurable; PO ratification advisable).
- **ASM-007** = Both — Inventory Status is a shortage board **plus** a health widget.
- **WEB-006** = refresh icon is **cache-only** — it must **not** fire `POST /api/admin/refresh`.
- Still 🔶 OPEN (PO): **ASM-002** thresholds, **ASM-003** project status — verify against the *configured default*, not as fixed truth.
