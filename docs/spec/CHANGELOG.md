# Spec Suite Changelog

Per the deviation rule (SPEC 05 §6): specs change by review, recorded here.

---

## 2026-07-21 — Test catalog pushback resolution

Applied the five findings from the automated/manual test coverage review.

| Finding | Fix |
|---|---|
| **MAN-306 contradiction** | `manual_tests/TC-MAN-stage3-web.md` (+ MAN-401) + SPEC 03 WEB-006: refresh re-reads `/api/*`; **"Last Updated" / `refreshedAt` does not change** because of the icon |
| **TEST-035 under-covered** | Added **MAN-508** cloud E2E repeat of TEST-034; MAN-504 = outage/email half; SPEC 05 TEST-035 points at MAN-504 + MAN-508 |
| **TEST-011.4 boundary** | Available=10 / Allocated=40 → **green** under strict `<` (ASM-002); clarified in `TC-AUTO-unit-service.md` + SPEC 05 |
| **Should/Could scope** | Documented as intentionally out of Must in automated README + unit coverage note |
| **SPEC 05 index** | Links to `automated_tests/` and `manual_tests/`; drills table maps to MAN-* IDs |

---

## 2026-07-21 — Spec suite v1.1.1 → v1.2 (sync to reviewer decisions)

Aligns the suite to [`decisions-log.md`](decisions-log.md) so implementers do not
follow stale OPEN wording.

| Fix | File | Change |
|---|---|---|
| **ASM-001 label** | `02-inventory-service.md` | SVC-002: ASM-001 marked ✅ DECIDED (reviewer), still configurable / PO ratification advisable |
| **Inventory Status** | `03-react-website.md` | §5 rewritten: ASM-007 = Both; **WEB-060** shortage board, **WEB-061** health widget, **WEB-062** loud failures, **WEB-063** refreshSeconds admin; acceptance criteria updated for WEB-006 cache-only + shortage/health page |
| **Suite index** | `00-overview.md` | Version **1.2-draft**; `decisions-log.md` + SPEC 06 listed in §2 |
| **SPEC 06** | `06-accuracy-review-pushback.md` | Verdict/scorecard/checklist match decided vs still-OPEN (ASM-002/003 only) |
| **TEST-034** | `05-testing-acceptance.md` | Manual refresh step clarified as cache-only (no admin re-pull) |

Still OPEN for PO: **ASM-002**, **ASM-003**. Build of Stages 1–3 is unblocked.

---

## 2026-07-21 — Spec suite v1.1 → v1.1.1 (minor consistency cleanups)

Second-pass review after v1.1: substance was fine; three wording gaps remained.
Recorded from re-review of SPEC 06 + CHANGELOG.

| Fix | File | Change |
|---|---|---|
| **§9 cutover wording** | `00-overview.md` | Out-of-scope bullet no longer says whole `dev.myx.ac` integration is “config-swap ready”; aligned with SVC-043 (feeds + project items yes; sale headers / MOCK-060 no). Spec version bumped to **1.1.1-draft**. |
| **SVC-020 SQL claim** | `02-inventory-service.md` | Removed “satisfies SQL or Redis”; now states Redis + in-memory only, SQL as deliberate omission per SPEC 00 §4. |
| **SPEC 06 body stale** | `06-accuracy-review-pushback.md` | Verdict, scorecard, and checklist refreshed to v1.1/v1.1.1 state; closed PBs checked off; remaining PO confirms listed separately. |

No new blockers. Approval stance unchanged: replica Stages 1–3 OK against 🔶 OPEN defaults; PO confirms still required for trustworthy numbers.

---

## 2026-07-21 — Spec suite v1.0 → v1.1 (SPEC 06 pushback resolution)

Applied the seven pushbacks from
[`06-accuracy-review-pushback.md`](06-accuracy-review-pushback.md). These are
**spec-text corrections for reviewer re-review** — no code exists yet, and the
🔶 OPEN items still require Product-Owner confirmation before their behavior can
be trusted as accurate.

| PB | Verdict | Resolution in specs |
|---|---|---|
| **PB-001** | Blocker | SPEC 00 §5 restructured: ASM-001/002/003 reclassified from silent "Must rules" to **🔶 OPEN — needs PO**, shipped as **configurable defaults** (named strategies read from config), never hard-coded. Added an explicit build guardrail and the ⚠️ note that the default `Available = OnHand − Allocated` ignores `onPO` and may diverge from the real Power BI numbers. SVC-002/003 reworded to reference the config strategy; TEST-016 added to prove config drives the math. |
| **PB-002** | Blocker | SVC-043 rewritten. The "zero code changes to point at real middleware" claim is **retracted**; it now holds only for the three feeds + per-project items. Sale headers (MOCK-060) are labeled **replica-only** with no real source (ASM-005), and will break on a real-endpoint swap until a genuine source is identified. |
| **PB-003** | High | Added SVC-001a documenting the on-demand project-fetch as an **intentional** design with defined consistency/failure behavior (joined to snapshot `refreshedAt`; 503 on failure via SVC-042a, no per-project stale cache). SVC-001b records the optional cached-project-index upgrade path (deferred). |
| **PB-004** | High | ASM-007 reclassified 🔶 OPEN. SPEC 03 §5 now frames WEB-060…062 as a **working assumption** (health page) with the alternative reading (operational shortage board) called out for PO confirmation. |
| **PB-005** | Medium | SPEC 00 §4 gains a **Deliberate omissions** table; the SQL-Server cache alternative is documented as intentionally not implemented (in-memory + Redis only), not claimed as "exact per docx". |
| **PB-006** | Medium | SPEC 00 §1 rewritten: "exact architecture" → "layer-for-layer replica", with an explicit **replica ≠ production** statement listing what production would additionally require. |
| **PB-007** | Low | (a) **JS vs TS resolved → TypeScript** across all three workspaces (SPEC 03 header note). (b) **Admin-endpoint auth** added: SVC-045 (shared-secret guard) + AZ-011a (Key Vault `ADMIN_TOKEN`, mock admin routes not public) + TEST-018. (c) **RBAC** documented as deferred (WEB-009). (d) **Manual-refresh semantics** flagged 🔶 unconfirmed on WEB-006 (default = force re-pull). |

### Net effect on approval

The suite is now honest about the line between **verified replica engineering**
(architecture, API shapes, cache/refresh/health, UI structure — safe to build)
and **inferred business rules** (ASM-001/002/003/007 — build against configurable
defaults, but confirm with Michael Agrusso / Jay Wolgin before trusting the
numbers). The SPEC 06 "safe-to-approve checklist" items are now reflected in the
spec text; the remaining action is the reviewer's — approve/amend the 🔶 OPEN
defaults, then Stages 1–3 are clear to build.
