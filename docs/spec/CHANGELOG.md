# Spec Suite Changelog

Per the deviation rule (SPEC 05 §6): specs change by review, recorded here.

---

## 2026-07-21 — Verification pushback fixes (PB-V-001/002/005)

Independent verification run
([`../verification/VERIFICATION-PUSHBACK.md`](../verification/VERIFICATION-PUSHBACK.md))
returned "verified with findings". Fixed:

| PB-V | Severity | Fix |
|---|---|---|
| PB-V-001 | Blocker (hygiene) | The two `.docx` requirement files were still **tracked** in git despite `*.docx` in `.gitignore` (ignore does not untrack). Untracked via `git rm --cached` (files remain on disk). `git ls-files \| grep -i docx` now empty → MOCK-005 satisfied. |
| PB-V-002 | Medium (quality) | `inventory-service/src/consolidator.ts` held one raw `\x00` byte — the `keyOf` composite-key delimiter written as a literal null instead of an escape. Replaced with an explicit `\\u0000` escape: **identical runtime keys** (256 rows, 0 blank-category, unique keys intact), source now clean UTF-8. tsc + 50 tests still green. |
| PB-V-005 | Doc clarity | BUILD-VERIFICATION §8 credential-hygiene check tightened to require `git ls-files` (not ignore-alone) + `git check-ignore`. |

Still open, handed to the reviewer (not code defects): **PB-V-003** (browser
Stage 3/4 drills MAN-301…309 / MAN-401) and **PB-V-004** (live Azure, blocked on
DEC-001/DEC-002). PB-V-006 (the eight build deviations) was accepted by the
verifier with no change.

---

## 2026-07-21 — Implementation build (Stages 1–5, suite v1.2)

First code build of the whole replica against spec suite v1.2. All four packages
typecheck; **50 automated tests pass** (21 contract + 29 unit); the live stack
was smoke-tested end-to-end (consolidation, filters, project split, outage
last-good, project-503). Deviations and design decisions logged below per the
rule — none change an approved **M** requirement's intent; they are additive or
substitutions already permitted by the spec.

| # | Deviation / decision | Spec touchpoint | Rationale |
|---|---|---|---|
| 1 | **Added a `shared/` workspace** (the typed contract: BC shapes, `AvailabilityConfig`/`DEFAULT_CONFIG`, `ConsolidatedItem`, `Snapshot`, envelopes) beyond the four dirs in SPEC 00 §8. | SPEC 00 §8, PB-007 | PB-007 explicitly wants "a shared typed contract compiled across service and web." One package is the cleanest way; §8 layout otherwise unchanged. |
| 2 | **Runtime = `tsx`, not compiled JS**, in dev *and* Azure. `shared` exports raw `.ts`; apps start via `tsx src/index.ts`; deploy ships the monorepo. | SPEC 04 (AZ-061) | Simplest for a replica; avoids a build/emit step. If JS emit is added later, switch App Service startup to `node`. |
| 3 | **`bcClient.getProjects()` added** beyond the four enumerated BC clients. | SVC-042 | Needed for the sale-header proxy (`GET /api/projects` ← MOCK-060). |
| 4 | **Consolidator item-metadata master** — demand-only item+locations are enriched (category/i360Id/sqft) from the inventory+PO feeds by `itemNo`. | SVC-002, WEB-022/023 | Demand rows lack metadata; without this, a shortage row demanded where an item isn't stocked rendered under a blank category group. Caught by live smoke test, not fixtures. |
| 5 | **`*.docx` gitignored** (source requirement docs hold the real `refloor_auth` credential). | MOCK-005 | Keeps the credential out of the committed repo; requirements already extracted to `docs/`. TEST-024.5's automated form is therefore a CI/manual grep over source, since the only copy of the secret is the now-ignored `.docx`. |
| 6 | **AZ-012 resolved to the injected-base option:** web reads `VITE_API_BASE_URL` (unset in dev → relative `/api` via Vite proxy; set at Azure build → absolute service URL). Not the same-origin-rewrite option. | AZ-012 | Both were spec-permitted; injected base matches the deploy scripts and keeps WEB-003 (browser → service only). |
| 7 | **Mock `/admin/outage` on Azure is protected by IP restriction** (`--mock-cidr`), not a token guard — the mock does not implement `ADMIN_TOKEN` gating (the service does). | AZ-011a | AZ-011a allows "internal / IP-restricted **or** token-gated"; IP restriction is used for the mock. Token gating the mock is a later hardening if wanted. |
| 8 | **Not built (Should/Could, per spec priority):** WEB-029 (grid virtualization), WEB-030 (Ordered tooltip), WEB-050 rendered as a native type-ahead `<select>` rather than a free-text search, SVC-034 (App Insights wiring — optional), SVC-001b (deferred), AZ-050/051 (Could). | various | All non-**M**; recorded so their absence is a decision, not an oversight. |

No **M** requirement was dropped or reinterpreted. ASM-002/003 remain 🔶 OPEN and
config-driven (TEST-016 green). Next gate: the manual Stage 1–4 checkpoint drills
in [`manual_tests/`](manual_tests/) with the reviewer.

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
