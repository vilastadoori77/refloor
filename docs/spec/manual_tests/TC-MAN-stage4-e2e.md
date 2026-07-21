# Manual — Stage 4 Checkpoint: Full Local Run-Through (E2E)

Gate: the whole local stack behaves end-to-end before any cloud port.
Traces: TEST-034 + the project Definition of Done (SPEC 05 §5).

**Preconditions:** full stack up; Stages 1–3 signed off; automated suite green.

---

## MAN-401 — End-to-end happy-path + failure flow (TEST-034)

| Field | Value |
|---|---|
| **Traces** | TEST-034, WEB-006, ASM-007, SVC-014 |
| **Priority** | Must |

**Scripted flow (one continuous session)**
1. **Filter a satellite** on the Satellites screen → confirm grouped, colored grid.
2. **Find a shortage item** (yellow/red Available).
3. **Open a short project** (MOCK-045e) → see the two tables + item statuses.
4. **See the gold callout** ("additional materials not available").
5. **Click the header refresh** → confirm **cache-only** (WEB-006): on-screen data re-fetches from `/api/*`, **no `POST /api/admin/refresh`** in network, **"Last Updated" / `refreshedAt` not force-advanced** by the icon.
6. **Open Inventory Status** → shortage board lists the yellow/red rows **and** the health widget shows `/api/status` (ASM-007 = Both).
7. **Kill the mock mid-session** (or enable full outage) → wait a cycle.
8. **Verify stale-but-served:** satellite views still render the previous snapshot with the OLD `refreshedAt`; health widget goes loud (red banner / stale badge); a project fetch now returns 503 (SVC-042a).
9. **Restore the mock** → recovery within one cycle; `refreshedAt` advances; banners clear.

**Expected:** every step behaves as described with no console errors and no `/BC/*` request ever visible in the browser.
**Result:** ☐ Pass ☐ Fail — session recording/screenshots: ____

---

## MAN-402 — Definition of Done audit (whole project)

| Field | Value |
|---|---|
| **Traces** | SPEC 05 §5 |
| **Priority** | Must |

**Checklist**
- ☐ Every **M** requirement in specs 01–04 implemented and its acceptance criteria checked (Stages 1–3 sign-offs attached).
- ☐ All unit + contract tests green in `npm test` (link CI run / local output).
- ☐ All drills executed with reviewer present or evidence captured (MAN-104, MAN-204, MAN-304, MAN-306, MAN-307, MAN-401; Stage 5: MAN-504 + MAN-508).
- ☐ **No source credential anywhere in the repo** — verified by grep (MOCK-005 / TEST-024.5).
- ☐ README documents: run instructions, architecture summary, how to point at real endpoints later (SVC-043 — feeds/project-items only; sale headers replica-only), cost/teardown notes.
- ☐ Repo committed with spec suite, code, tests, deploy scripts.

**Result:** ☐ Pass ☐ Fail — DoD evidence bundle: ____

---

## MAN-403 — Replica-boundary honesty check

| Field | Value |
|---|---|
| **Traces** | SPEC 00 §1/§9, SVC-043, ASM-005 |
| **Priority** | Should |

**Steps:** confirm the README / UI does not overstate production-readiness.
**Expected:** it is clear that (a) sale headers are replica-only (MOCK-060), (b) ASM-002/003 remain 🔶 OPEN pending PO, (c) auth/domain are substituted. No text claims "exact production behavior."
**Result:** ☐ Pass ☐ Fail — ____

---

### Stage 4 sign-off

☐ All Must cases pass · Reviewer: ______ · Date: ______ · Ready for Stage 5 (Azure): ☐ Yes ☐ No
