# Review Status — Inventory Availability Flash Replica

**Last updated:** 2026-07-21  
**Audience:** Reviewer / Product Owner / next agent  
**Spec suite:** v1.2 · **Build:** Stages 1–5 code present · **Automated tests:** 50/50 green

This is the **single entry point** for “what’s done vs what’s still open.”  
Deep detail lives in the linked docs; you should not need the chat history.

---

## 1. One-line status

**Local replica build is verified — automated gates and browser sign-off complete.**  
**Still open:** Azure live deploy, and two PO business-rule confirms.

| Area | Status |
|---|---|
| Specs (00–06) + test catalogs | ✅ Ready |
| Code (mock / service / web / deploy scripts) | ✅ Built |
| Automated gates (tsc + `npm test`) | ✅ Pass (50 tests) |
| Verification hygiene pushbacks (PB-V-001/002/005) | ✅ Fixed |
| Browser Stage 3–4 drills (PB-V-003) | ✅ Done (reviewer, 2026-07-21) |
| Azure live Stage 5 | ⏳ Deferred (needs DEC-001/002) |
| PO: ASM-002 / ASM-003 | ⏳ Open (defaults in use) |

---

## 2. Still open — action list

### A. Reviewer — browser ✅ DONE (2026-07-21)

**PB-V-003 completed by the reviewer** — Stage 3 UI (MAN-301…309) + Stage 4 E2E
(MAN-401) walked in the browser; per-case results recorded in the reviewer's
catalog. This was the last gate blocking "fully verified" on the local replica.
See §3 (closed) and §7 (closure log).

### B. Reviewer — Azure (after decisions)

| ID | What | How | Done when |
|---|---|---|---|
| **DEC-001** | Cost tier | Free (F1 + memory) vs Paid (B1 + Redis) — record in `docs/spec/decisions-log.md` | Decision logged |
| **DEC-002** | Auth | Dev-stub vs Entra ID — same log | Decision logged |
| **PB-V-004** | Live cloud | `az login` → `deploy/provision.sh` + `deploy/deploy-apps.sh` → MAN-501…508 (esp. MAN-504 + MAN-508) | Stage 5 Pass or explicitly deferred |

### C. Product Owner — business rules (can ship replica on defaults)

| ID | Question | Current default (configurable) | Risk if wrong |
|---|---|---|---|
| **ASM-002** | Satellite cell colors (green/yellow/red)? | Red if Available &lt; 0; yellow if 0 ≤ Available &lt; 25% of Allocated (min 10 when Allocated = 0); else green | Wrong urgency coloring |
| **ASM-003** | Project item Ready / Attention / Short? | Ready if Available ≥ Required; Attention if Available + Ordered covers Required; else Short | Wrong scheduling guidance |

Defaults are **not hard-coded** — change via config / `PUT /api/admin/config` (PB-001 guardrail; TEST-016).  
Optional: also ratify **ASM-001** (`Available = OnHand − Allocated`; ignores `onPO`) — already reviewer-decided; PO ratification advisable.

---

## 3. Already closed — do not re-open without cause

| ID | Topic | Where logged |
|---|---|---|
| Spec PB-001…007 | Spec accuracy pushbacks | `docs/spec/06-accuracy-review-pushback.md`, `docs/spec/CHANGELOG.md` |
| Reviewer decisions | ASM-001, ASM-007=Both, WEB-006=cache-only | `docs/spec/decisions-log.md` |
| **PB-V-001** | `.docx` untracked from git (credential hygiene) | `docs/spec/CHANGELOG.md` “Verification pushback fixes” |
| **PB-V-002** | Null byte removed from `consolidator.ts` | same |
| **PB-V-005** | BUILD-VERIFICATION §8 clarified | same |
| **PB-V-006** | Eight build deviations accepted | `VERIFICATION-PUSHBACK.md` |
| **PB-V-003** | Browser Stage 3 (MAN-301…309) + Stage 4 (MAN-401) drills done by reviewer | this file §7; reviewer catalog |
| Scripted verification | G1/G2, Stages 0–2, Stage 3 static, Stage 5 syntax | `BUILD-VERIFICATION.md` |

---

## 4. How to re-verify quickly (5 minutes)

```bash
cd <repo-root>
npm test
for p in shared mock-bc-api inventory-service inventory-web; do
  node_modules/.bin/tsc -p $p/tsconfig.json && echo "$p OK"
done
git ls-files | grep -i docx || echo "OK: no docx tracked"
```

Full adversarial runbook: [`BUILD-VERIFICATION.md`](BUILD-VERIFICATION.md).

---

## 5. Document map (read in this order)

| Order | Doc | Why |
|---|---|---|
| 1 | **This file** (`REVIEW-STATUS.md`) | What’s open vs done |
| 2 | [`BUILD-VERIFICATION.md`](BUILD-VERIFICATION.md) | Exact verify commands + sign-off table |
| 3 | [`VERIFICATION-PUSHBACK.md`](VERIFICATION-PUSHBACK.md) | Detailed PB-V findings / fix history |
| 4 | [`../spec/decisions-log.md`](../spec/decisions-log.md) | Reviewer + OPEN PO decisions |
| 5 | [`../spec/CHANGELOG.md`](../spec/CHANGELOG.md) | Spec + build + verification history |
| 6 | [`../spec/manual_tests/`](../spec/manual_tests/) + Excel catalog | Browser/Azure drill steps |

---

## 6. Suggested reviewer checklist

- [ ] Read §2A and run browser drills (PB-V-003)
- [ ] Confirm MAN-306 / MAN-307 especially
- [ ] Decide DEC-001 / DEC-002 (or explicitly defer Azure)
- [ ] If Azure: run PB-V-004 / MAN-501…508
- [ ] Send ASM-002 / ASM-003 to Michael Agrusso / Jay Wolgin (or accept defaults for replica)
- [ ] Update this file’s §7 when items close

---

## 7. Closure log (update when items finish)

| Item | Status | By | Date | Evidence |
|---|---|---|---|---|
| PB-V-003 browser | ✅ Done | Reviewer | 2026-07-21 | Browser walkthrough MAN-301…309 + MAN-401; results in reviewer catalog |
| PB-V-004 Azure | ⏳ Deferred | | | |
| DEC-001 | ⏳ Open | | | |
| DEC-002 | ⏳ Open | | | |
| ASM-002 PO | ⏳ Open | | | |
| ASM-003 PO | ⏳ Open | | | |

---

## 8. Change log for this file

| Date | Change |
|---|---|
| 2026-07-21 | Created as easy-review summary of open vs closed items after verification re-check |
