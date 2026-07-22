# BUILD-VERIFICATION Review — Pushbacks

**Author:** Cursor agent (independent verification run)
**Date:** 2026-07-21
**Against:** [`BUILD-VERIFICATION.md`](BUILD-VERIFICATION.md) · spec suite v1.2 · implementation build
**Stance:** Adversarial — commands were re-run; expected numbers checked against actuals.

**Purpose:** Record verification results and concrete pushbacks so another agent
(e.g. Claude) can correct them without needing this conversation. Specs change
by review ([`../spec/CHANGELOG.md`](../spec/CHANGELOG.md)); implementation
fixes should be logged there too when done.

> **For a short “what’s open / what’s done” view, start at
> [`REVIEW-STATUS.md`](REVIEW-STATUS.md).** This file is the detailed PB-V log.

---

## 1. Overall verdict

**Verified with findings.**

Scripted gates (G1, G2, Stages 0–2, Stage 3 static V3.1–3.2, Stage 5 syntax)
**passed** and matched the runbook’s seed-42 expectations. Browser Stages
(V3.3 / Stage 4) were **not** executed in this pass. One **Must-adjacent**
hygiene finding (tracked `.docx` with embedded credential) must be fixed
before claiming MOCK-005 / §8 clean.

| Gate | Result | Notes |
|---|---|---|
| G1 typecheck all | ✅ Pass | shared, mock-bc-api, inventory-service, inventory-web |
| G2 `npm test` = 50 | ✅ Pass | 6 files, 50 tests |
| Stage 0 scaffold | ✅ Pass | `DEFAULT_CONFIG` matches ASM-001 + ASM-002 defaults |
| Stage 1 mock (V1.1–1.4) | ✅ Pass | counts 236/57/81/14; outage; header |
| Stage 2 service (V2.1–2.5) | ✅ Pass | 256 rows; last-good; project 503; no leaks |
| Stage 3 web (V3.1–3.2) | ✅ Pass | tsc; ~164 kB; Azure URL bake-in; fetch isolation |
| Stage 3 browser (V3.3) | ⏸ Not run | Needs human/browser — MAN-301…309 |
| Stage 4 E2E (browser) | ⏸ Not run | Needs human/browser — MAN-401 |
| Stage 5 deploy (V5.1–5.2) | ✅ Pass (syntax/static) | Live Azure not run — MAN-501…508 |
| Cross-cutting (§8) | ⚠️ Pass with findings | See PB-V-* below |

---

## 2. What matched the runbook (do not regress)

Keep these green while fixing pushbacks:

- Seed 42: inventory **236**, POs **57**, demand **81**, saleHeaders **14**
- Demand: negative `netInventory` **24**, null `locationCode` **2**, identity holds
- Consolidated inventory **256** rows, **blank-category 0**, locations `CHA,DET,CIN,CHI,COL,GRR,CLE,IND`
- Project `PRJ50001`: flooring 2, additional 4, `additionalReady: false`
- Outage last-good: `refreshedAt` unchanged; inventory still 256; project endpoint **503**
- No `localhost:4000` / `BC_BASE_URL` / `BC_AUTH` in `/api` responses
- WEB-006: Header `onRefresh` → `bumpReload` only (no `POST /api/admin/refresh`)
- ASM-007: `StatusPage` = Shortage Board + Service Health widget
- Deploy scripts: `bash -n` clean on all five `deploy/*.sh`

---

## 3. Pushbacks (fix these)

Each item has an ID (`PB-V-xxx`) for CHANGELOG / PR tracking.

### PB-V-001 — Blocker (hygiene): `.docx` still tracked despite `.gitignore`

**Requirement:** MOCK-005, BUILD-VERIFICATION §8, CHANGELOG deviation #5 claim.

**Problem:** `.gitignore` contains `*.docx`, but both requirement Word files are
**still in the git index**:

- `React Inventory Website Requirements.docx`
- `API_React Inventory Website Requirements.docx`

`git check-ignore` does not apply to already-tracked files. The docs embed a
real `refloor_auth` credential. Leaving them tracked defeats MOCK-005.

**Expected after fix:**
```bash
git ls-files | grep -i docx
# → empty
```
Files may remain on disk locally; they must not be in the committed tree.

**Suggested fix:**
```bash
git rm --cached "React Inventory Website Requirements.docx" \
  "API_React Inventory Website Requirements.docx"
# Confirm *.docx is in .gitignore (already present)
# Commit with message noting MOCK-005 / credential hygiene
```

**Also:** Confirm TEST-024.5 / DoD grep still passes and does not rely on the
tracked `.docx` remaining in-repo. Update BUILD-VERIFICATION §8 if the wording
assumes “gitignore alone” without `git rm --cached`.

**Acceptance:** `git ls-files '*.docx'` empty; `npm test` still green; CHANGELOG
notes the fix under Implementation build or a new entry.

---

### PB-V-002 — Medium (quality): null byte in `consolidator.ts`

**Problem:** `inventory-service/src/consolidator.ts` contains at least one
`\x00` null byte (`file` reports type `data`; `python` count `nulls 1`).
Vitest/tsc still pass, but this is fragile for editors, `rg`, and some tooling.

**Suggested fix:** Re-save / rewrite the file as clean UTF-8 text (no nulls).
Prefer ASCII hyphen in the file header comment instead of a fancy dash if that
introduced encoding issues — keep PB-001 config-driven logic unchanged.

**Acceptance:**
```bash
python3 -c "p=open('inventory-service/src/consolidator.ts','rb').read(); assert p.count(b'\\x00')==0"
node_modules/.bin/tsc -p inventory-service/tsconfig.json
node_modules/.bin/vitest run inventory-service/test
```

---

### PB-V-003 — Process: complete browser gates (not a code defect yet)

**Problem:** BUILD-VERIFICATION correctly marks V3.3 and Stage 4 as browser-only.
They were not executed in this agent pass. Do not mark the project
“fully verified” until they pass.

**Required actions (human or browser-capable agent):**
1. `npm run dev` → http://localhost:5173
2. Walk `docs/spec/manual_tests/TC-MAN-stage3-web.md` **MAN-301…309**
   - Especially **MAN-306** (cache-only refresh) and **MAN-307** (board + widget)
3. Walk `TC-MAN-stage4-e2e.md` **MAN-401**
4. Record Pass/Fail in `docs/spec/manual_tests/manual-tests-catalog.xlsx` (or
   copy results into BUILD-VERIFICATION §9)

**Optional code aid (Could):** Playwright smoke for MAN-306 / MAN-304 network
isolation — not required by Must specs.

**Acceptance:** §9 sign-off Stage 3 (incl. V3.3) and Stage 4 marked Pass with
evidence (screenshots / HAR).

---

### PB-V-004 — Process: Stage 5 live cloud still open

**Problem:** V5.1–5.2 (syntax + static) passed. Live Azure (MAN-501…508 /
TEST-035) was not run — blocked on `az login` + DEC-001 + DEC-002.

**Required actions:**
1. Record DEC-001 (cost tier) and DEC-002 (auth) in `docs/spec/decisions-log.md`
2. Run `deploy/provision.sh` + `deploy/deploy-apps.sh`
3. Execute MAN-501…508 (especially MAN-504 + MAN-508 for TEST-035)

**Acceptance:** Stage 5 §9 Pass, or explicitly deferred with DEC-001/002 still
open and “live cloud N/A” noted in sign-off.

---

### PB-V-005 — Doc clarity (optional): BUILD-VERIFICATION §8 docx check

**Problem:** §8 says:

> `git ls-files | grep -i docx` empty; `.docx` gitignored; repo clean

After PB-V-001, add an explicit step so future verifiers don’t assume ignore
equals untracked:

```bash
# Must be empty (ignore alone is insufficient if files were committed earlier)
git ls-files | grep -i docx || echo "OK: no docx tracked"
git check-ignore -v "*.docx"   # should show .gitignore rule
```

**Acceptance:** BUILD-VERIFICATION.md §8 updated; this pushback file referenced
from BUILD-VERIFICATION §0 or §10 if useful.

---

### PB-V-006 — Informational: eight logged deviations — leave unless disputed

CHANGELOG “Implementation build” lists deviations 1–8 (`shared/` workspace,
`tsx` runtime, `getProjects` client, consolidator metadata enrichment, docx
gitignore intent, `VITE_API_BASE_URL`, mock IP restriction, Should/Could not
built).

**Verifier stance:** Acceptable for the replica; **none** reinterpret a Must’s
intent. **Do not reverse** without reviewer approval.

**Exception:** Deviation #5’s *intent* is correct but **incomplete in git** —
that is PB-V-001, not a reason to drop the ignore rule.

---

## 4. Suggested work order for the fixing agent

1. **PB-V-001** — `git rm --cached` the two `.docx` files; commit; re-run
   `git ls-files | grep -i docx` and `npm test`.
2. **PB-V-002** — strip null byte from `consolidator.ts`; re-run service tests.
3. **PB-V-005** — tighten BUILD-VERIFICATION §8 commands.
4. Log fixes in `docs/spec/CHANGELOG.md` (new short entry referencing PB-V-001/002/005).
5. Hand **PB-V-003** / **PB-V-004** to the reviewer (browser + Azure) — not
   blocking the hygiene/code cleanups.

---

## 5. Re-verification commands (after fixes)

```bash
cd <repo-root>
npm test
for p in shared mock-bc-api inventory-service inventory-web; do
  node_modules/.bin/tsc -p $p/tsconfig.json && echo "$p OK"
done
git ls-files | grep -i docx || echo "OK: no docx tracked"
python3 -c "p=open('inventory-service/src/consolidator.ts','rb').read(); assert p.count(b'\\x00')==0; print('consolidator clean')"
```

Then re-check BUILD-VERIFICATION §9 and mark PB-V-* resolved in this file’s
changelog (§6).

---

## 6. Change log for this review doc

| Date | Change |
|---|---|
| 2026-07-21 | Initial verification run recorded; PB-V-001…006 opened |
| 2026-07-21 | PB-V-001/002/005 fixed and re-verified; logged in spec CHANGELOG; PB-V-003/004 handed to reviewer |
| 2026-07-21 | **Re-verify by Cursor:** CHANGELOG claims confirmed live — docx untracked, consolidator nulls=0 (`\\u0000` escape), §8 updated, `npm test` 50 green, all tsc OK. CHANGELOG.md itself had 1 stray NUL from the fix write-up — stripped. PB-V-003/004 still reviewer-owned. |

---

## 7. Sign-off after fixes

| Pushback | Status | Fixed by | Date | Evidence |
|---|---|---|---|---|
| PB-V-001 docx untrack | ✅ Fixed | Claude | 2026-07-21 | `git rm --cached` both `.docx`; `git ls-files \| grep -i docx` empty; files remain on disk |
| PB-V-002 consolidator null byte | ✅ Fixed | Claude | 2026-07-21 | raw `\x00` → ` ` escape; `null bytes: 0`; identical keys (256 rows / 0 blank); tsc + 50 tests green |
| PB-V-003 browser Stage 3/4 | ✅ Done by reviewer | Reviewer | 2026-07-21 | MAN-301…309 + MAN-401 walked in browser; results in reviewer catalog |
| PB-V-004 Azure live | ⏳ Deferred | — | — | blocked on DEC-001/DEC-002 + `az login` |
| PB-V-005 runbook §8 clarity | ✅ Fixed | Claude | 2026-07-21 | §8 now requires `git ls-files` + `git check-ignore`, not ignore-alone |
| PB-V-006 deviations accepted | ✅ Accepted (no code change) | verifier | 2026-07-21 | eight build deviations — none reinterpret a Must |

**Re-verification (§5 commands) after fixes — all pass:** `npm test` 50/50 · all
four packages `tsc` clean · `git ls-files \| grep -i docx` empty · consolidator
null-byte count 0.
