# Build Verification Runbook — Inventory Availability Flash Replica

**Purpose:** a self-contained, reproducible guide for an **independent agent** to
verify the implementation stage by stage. You do not need any prior conversation
context — everything you need is here plus the repo and the spec suite.

**Build date:** 2026-07-21 · **Against spec suite:** v1.2 · **Verifier stance:**
adversarial — do not trust the "Expected" numbers below; re-run the commands and
confirm they match. If anything diverges, that is a finding.

---

## 0. How to use this document

1. Read [`../spec/00-overview.md`](../spec/00-overview.md) §3–§5 and
   [`../spec/decisions-log.md`](../spec/decisions-log.md) so you know the
   architecture, the substitutions, and the three reviewer decisions in force.
2. Work top to bottom. Each stage has: **files**, **what to verify**, **exact
   commands**, **expected output**, and a **pass/fail** line.
3. The dataset is deterministic from `MOCK_SEED=42` (default). All counts below
   are for seed 42 — you must get the identical numbers.
4. Record results in the **§8 sign-off table**. Report every divergence with the
   command, expected, and actual.
5. Cross-references: automated test cases live in
   [`../spec/automated_tests/`](../spec/automated_tests/); manual reviewer drills
   in [`../spec/manual_tests/`](../spec/manual_tests/); logged deviations in
   [`../spec/CHANGELOG.md`](../spec/CHANGELOG.md) ("Implementation build" entry).
   Independent verification findings / pushbacks:
   [`VERIFICATION-PUSHBACK.md`](VERIFICATION-PUSHBACK.md).
   **Easy review summary (start here):** [`REVIEW-STATUS.md`](REVIEW-STATUS.md).

**Environment:** Node 18+ only (built on Node 23.11). No Docker/Azure needed for
Stages 0–4. Ports used: mock 4000, service 4100, web 5173.

---

## 1. Global gates (run first)

```bash
cd <repo-root>
npm install                 # npm workspaces; ~230 packages
```

### G1 — Typecheck every package
```bash
for p in shared mock-bc-api inventory-service inventory-web; do \
  node_modules/.bin/tsc -p $p/tsconfig.json && echo "$p OK"; done
```
**Expected:** `shared OK`, `mock-bc-api OK`, `inventory-service OK`, `inventory-web OK` — zero type errors.

### G2 — Full automated test suite
```bash
npm test
```
**Expected:** `Test Files 6 passed (6)` · `Tests 50 passed (50)`.
Breakdown: 21 in `mock-bc-api/test/contract.test.ts`, 29 across the 5
`inventory-service/test/*.test.ts` files.

**Pass/fail G1+G2:** ☐

---

## 2. Stage 0 — Workspace scaffold

**Files:** `package.json` (workspaces: shared, mock-bc-api, inventory-service,
inventory-web), `tsconfig.base.json`, `vitest.config.ts`, `shared/src/index.ts`.

**Verify**
- `shared/src/index.ts` defines the single contract: BC raw shapes, `AvailabilityConfig` + `DEFAULT_CONFIG`, `ConsolidatedItem`, `Snapshot`, `ProjectView`, `StatusResponse`, envelopes, `SATELLITES` (8), `ITEM_CATEGORIES` (5).
- `DEFAULT_CONFIG.availabilityStrategy === 'onHandMinusAllocated'` (ASM-001 decision), thresholds `{redBelow:0, yellowFractionOfAllocated:0.25, yellowMinUnitsWhenNoAllocated:10}` (ASM-002 defaults), `refreshSeconds: 60`.

```bash
node_modules/.bin/tsx -e "import('@inventory/shared').then(m=>console.log(JSON.stringify(m.DEFAULT_CONFIG)))"
```
**Expected:** `{"refreshSeconds":60,"availabilityStrategy":"onHandMinusAllocated","thresholds":{"redBelow":0,"yellowFractionOfAllocated":0.25,"yellowMinUnitsWhenNoAllocated":10},"projectStatusStrategy":"availabilityVsRequired"}`

**Pass/fail:** ☐

---

## 3. Stage 1 — Mock BC API (SPEC 01)

**Files:** `mock-bc-api/src/{rng,catalog,dataset,outage,index}.ts`, `test/contract.test.ts`.
**Traces:** MOCK-001…072. **Automated backing:** `automated_tests/TC-AUTO-contract-mock.md` (TEST-020…024).

### V1.1 — Contract tests
```bash
node_modules/.bin/vitest run mock-bc-api/test
```
**Expected:** 21 passed — covers all four `/BC/*` shapes & casing (incl. `expected_Receipt_Date`), determinism, demand≡union-of-projects, `netInventory` identity, all six MOCK-045 edge cases, outage toggle, auth-segment-ignored, `X-Mock-Api` header, 404 unknown project.

### V1.2 — Deterministic dataset shape (boot the mock, seed 42)
```bash
MOCK_PORT=4000 node_modules/.bin/tsx mock-bc-api/src/index.ts >/tmp/mock.log 2>&1 &
sleep 1
echo "inventory:"      $(curl -s localhost:4000/BC/GetInventory       | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).length))")
echo "purchaseOrders:" $(curl -s localhost:4000/BC/GetPurchaseOrders  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).length))")
echo "demand:"         $(curl -s localhost:4000/BC/Demand             | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).length))")
echo "saleHeaders:"    $(curl -s localhost:4000/BC/_mock/GetProjects  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).length))")
```
**Expected (seed 42):** inventory **236**, purchaseOrders **57** (~24%), demand **81**, saleHeaders **14** (≥12 projects).

### V1.3 — Edge cases (MOCK-045) present
```bash
curl -s localhost:4000/BC/Demand | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);console.log('negative netInventory:',r.filter(x=>x.netInventory<0).length);console.log('null locationCode:',r.filter(x=>x.locationCode===null).length);console.log('netInventory identity holds:',r.every(x=>x.netInventory===x.qoh+x.onPO-x.demand))})"
```
**Expected:** negative netInventory **≥ 3** (seed 42: 24), null locationCode **≥ 2** (seed 42: 2), identity holds **true** for every row.

### V1.4 — Outage switch + markers
```bash
curl -s -X POST localhost:4000/admin/outage -H 'Content-Type: application/json' -d '{"enabled":true,"endpoints":["inventory"]}' >/dev/null
echo "inventory during outage:" $(curl -s -o /dev/null -w "%{http_code}" localhost:4000/BC/GetInventory)   # expect 500
echo "demand during outage:"    $(curl -s -o /dev/null -w "%{http_code}" localhost:4000/BC/Demand)          # expect 200
echo "X-Mock-Api header:"       $(curl -s -D - -o /dev/null localhost:4000/BC/Demand | grep -i x-mock-api)
curl -s -X POST localhost:4000/admin/outage -H 'Content-Type: application/json' -d '{"enabled":false}' >/dev/null
kill %1 2>/dev/null
```
**Expected:** inventory `500`, demand `200`, header `x-mock-api: true`.

**Pass/fail Stage 1:** ☐  (also cross-check `manual_tests/TC-MAN-stage1-mock-api.md`)

---

## 4. Stage 2 — Inventory Service (SPEC 02)

**Files:** `inventory-service/src/{config,consolidator,bcClient,refresh,health,alerts,log,api,index}.ts`, `src/cache/{store,memory,redis,index}.ts`, `test/*.test.ts`.
**Traces:** SVC-001…045. **Automated backing:** `automated_tests/TC-AUTO-unit-service.md` (TEST-010…018).

### V2.1 — Unit tests (incl. the config-driven keystone TEST-016)
```bash
node_modules/.bin/vitest run inventory-service/test
```
**Expected:** 5 files, 29 passed. Confirm `consolidator.test.ts` includes the TEST-016 proof (same fixtures under `onHandMinusAllocated` vs `netInventory` yield different `available` AND different color — proving nothing is hard-coded, PB-001 guardrail).

### V2.2 — Live consolidation + filters (boot mock + service)
```bash
MOCK_PORT=4000 node_modules/.bin/tsx mock-bc-api/src/index.ts >/tmp/mock.log 2>&1 &
PORT=4100 BC_BASE_URL=http://localhost:4000 node_modules/.bin/tsx inventory-service/src/index.ts >/tmp/svc.log 2>&1 &
until curl -sf localhost:4100/healthz >/dev/null; do sleep 0.5; done; sleep 2
curl -s localhost:4100/api/status    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=JSON.parse(d);console.log('healthy',s.healthy,'sources',JSON.stringify(s.sources))})"
curl -s localhost:4100/api/inventory | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const e=JSON.parse(d);console.log('rows',e.data.length,'blank-category',e.data.filter(r=>!r.itemCategoryCode).length)})"
curl -s "localhost:4100/api/inventory?location=DET" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const e=JSON.parse(d);console.log('DET rows',e.data.length,'all DET?',e.data.every(r=>r.locationCode==='DET'))})"
curl -s localhost:4100/api/locations  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('locations',JSON.parse(d).data.map(l=>l.code).join(',')))"
```
**Expected:** healthy `true`, sources inventory/purchaseOrders/demand all `ok` with rowCounts 236/57/81; inventory **256 rows, blank-category 0**; DET filter returns only DET rows; locations `CHA,DET,CIN,CHI,COL,GRR,CLE,IND`.
> Note: 256 consolidated > 236 inventory rows because demand-only item+locations (shortages where an item is demanded but not stocked at that location) become rows too; their metadata is enriched by `itemNo` (deviation #4 in CHANGELOG). **blank-category must be 0.**

### V2.3 — Project view split + readiness
```bash
curl -s localhost:4100/api/projects/PRJ50001 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const v=JSON.parse(d).data;console.log('flooring',v.flooring.length,'additional',v.additional.length,'status',JSON.stringify(v.status))})"
```
**Expected:** flooring 2, additional 4, `status {"flooringReady":true,"additionalReady":false}` (a MOCK-045(e)-style project → drives the gold callout).

### V2.4 — Outage last-good (SVC-014) + project 503 (SVC-042a)
```bash
B=$(curl -s localhost:4100/api/status | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).refreshedAt))")
curl -s -X POST localhost:4000/admin/outage -H 'Content-Type: application/json' -d '{"enabled":true}' >/dev/null
curl -s -X POST localhost:4100/api/admin/refresh >/dev/null           # force a cycle (admin guard off locally)
sleep 1
curl -s localhost:4100/api/status | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=JSON.parse(d);console.log('after',s.refreshedAt,'healthy',s.healthy,'fails',s.consecutiveFailures)})"
echo "before was $B  (refreshedAt MUST be unchanged)"
echo "inventory still serving:" $(curl -s localhost:4100/api/inventory | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(String(JSON.parse(d).data.length)))")
curl -s -X POST localhost:4000/admin/outage -H 'Content-Type: application/json' -d '{"enabled":true,"endpoints":["project"]}' >/dev/null
echo "project during outage:" $(curl -s -o /dev/null -w "%{http_code}" localhost:4100/api/projects/PRJ50001)   # expect 503
curl -s -X POST localhost:4000/admin/outage -H 'Content-Type: application/json' -d '{"enabled":false}' >/dev/null
```
**Expected:** `after` refreshedAt **identical to `before`** (last-good), healthy `false`, fails ≥1; inventory still serving **256**; project fetch during outage **503**.

### V2.5 — Isolation invariant (SVC-044 / WEB-003)
```bash
curl -s localhost:4100/api/status localhost:4100/api/inventory | grep -c -iE "localhost:4000|BC_BASE_URL|BC_AUTH"
kill %1 %2 2>/dev/null
```
**Expected:** `0` — no middleware URL/credential ever appears in an `/api` response.

**Pass/fail Stage 2:** ☐  (also cross-check `manual_tests/TC-MAN-stage2-service.md`)

---

## 5. Stage 3 — React Website (SPEC 03)

**Files:** `inventory-web/src/{main,App,auth,api,theme.css,format,vite-env.d.ts}`, `src/components/*`, `src/hooks/*`, `src/pages/{SatellitePage,ProjectPage,StatusPage}.tsx`.
**Traces:** WEB-001…063. **Manual drills:** `manual_tests/TC-MAN-stage3-web.md` (MAN-301…309).

### V3.1 — Typecheck + build (both modes)
```bash
node_modules/.bin/tsc -p inventory-web/tsconfig.json && echo "tsc OK"
(cd inventory-web && ../node_modules/.bin/vite build) 2>&1 | tail -3
(cd inventory-web && VITE_API_BASE_URL=https://demo-svc.example.net ../node_modules/.bin/vite build >/dev/null 2>&1 && grep -o "demo-svc.example.net/api" dist/assets/*.js | head -1)
```
**Expected:** `tsc OK`; build succeeds (bundle ~164 kB); Azure-mode build bakes `demo-svc.example.net/api` into the bundle (AZ-012). Dev/default build uses relative `/api`.

### V3.2 — Isolation static check (WEB-003)
```bash
grep -rn "fetch(" inventory-web/src            # every fetch must target /api, via api.ts
grep -rn "/BC/" inventory-web/src              # must be empty or comments only
```
**Expected:** the only `fetch()` calls are in `src/api.ts` and target `${API_BASE}` = `/api`; no `/BC/*` request path anywhere.

### V3.3 — Browser drills (manual — reviewer/agent with a browser)
Boot the full stack (`npm run dev`), open http://localhost:5173, sign in at the
dev-stub gate, then walk **MAN-301…309** in `TC-MAN-stage3-web.md`. Key ones:
- **MAN-306 (WEB-006 cache-only):** clicking the header refresh icon fires **no** `POST /api/admin/refresh` (check Network tab) and does not force-advance `refreshedAt`.
- **MAN-307 (ASM-007 = Both):** Inventory Status shows the shortage board **and** the health widget.
- **MAN-304 (WEB-003):** Network tab shows only `/api/*`, never `/BC/*`.

**Pass/fail Stage 3:** ☐ (V3.1/V3.2 scriptable now; V3.3 needs a browser)

---

## 6. Stage 4 — End-to-end (TEST-034)

Boot `npm run dev` and walk `manual_tests/TC-MAN-stage4-e2e.md` MAN-401 (one
continuous session: filter satellite → find shortage → open short project → gold
callout → cache-only refresh → Inventory Status board+widget → kill mock → stale-
but-served → project 503 → restore → recovery). The scripted API-level halves of
this (outage last-good, project 503) are already proven in **V2.4**; MAN-401 adds
the browser click-through.

**Pass/fail Stage 4:** ☐ (browser)

---

## 7. Stage 5 — Azure deploy scripts (SPEC 04)

**Files:** `deploy/{common,provision,deploy-apps,alerts,teardown}.sh`, `deploy/README.md`.
**Traces:** AZ-001…064. **NOT executed here** (needs `az login` + DEC-001/DEC-002).

### V5.1 — Syntax
```bash
for f in common provision deploy-apps alerts teardown; do bash -n deploy/$f.sh && echo "$f OK"; done
```
**Expected:** all five `OK`.

### V5.2 — Static review (read, do not run)
Confirm in `provision.sh`: single RG `rg-inventory-flash` (AZ-001); three App
Services (AZ-002); HTTPS-only (AZ-005); Key Vault + managed identity + KV-reference
app settings, **no plaintext secret** (AZ-010/011a); `NODE_ENV=production` on the
service (activates the SVC-045 admin guard); `REFRESH_SECONDS=300`,
`WEB_ORIGIN`, `CACHE_DRIVER` per tier (AZ-011); Redis on `--tier paid` (AZ-021);
App Insights (AZ-040); `/healthz` health check (AZ-042); Easy Auth on `--auth entra`
(AZ-031). `teardown.sh` = confirm + `az group delete` (AZ-062).

**Known Stage-5 items (see CHANGELOG deviations 6–8):** web uses injected
`VITE_API_BASE_URL`; mock admin routes protected by IP restriction (`--mock-cidr`),
not token; AZ-050/051 (Could) not built.

**Pass/fail Stage 5:** ☐ (syntax + static review only; live cloud = MAN-501…508)

---

## 8. Cross-cutting checks

| Check | How | Expected |
|---|---|---|
| **Reviewer decisions honored** | `DEFAULT_CONFIG` strategy = `onHandMinusAllocated` (ASM-001); Inventory Status page has board+widget (ASM-007); refresh icon cache-only (WEB-006) | all three present |
| **PB-001 config guardrail** | TEST-016 green; no availability/threshold literal branch in `consolidator.ts` outside the config read | no hard-coded business rule |
| **ASM-002/003 still OPEN** | thresholds/project-status come from config, changeable via `PUT /api/admin/config` | configurable, not locked |
| **Credential hygiene (MOCK-005)** | `git ls-files \| grep -i docx` MUST be empty — ignore alone is insufficient if the files were committed earlier, so they were untracked via `git rm --cached` (they remain on disk). Also `git check-ignore -v '*.docx'` should show the `.gitignore` rule. | no `.docx` tracked; `*.docx` ignored; no token in tracked source |
| **Deviations logged** | CHANGELOG "Implementation build" entry lists 8 items | present |

---

## 9. Verifier sign-off table

| Gate | Result | Notes / divergences |
|---|---|---|
| G1 typecheck all | ☐ Pass ☐ Fail | |
| G2 `npm test` = 50 | ☐ Pass ☐ Fail | |
| Stage 0 scaffold | ☐ Pass ☐ Fail | |
| Stage 1 mock (V1.1–1.4) | ☐ Pass ☐ Fail | |
| Stage 2 service (V2.1–2.5) | ☐ Pass ☐ Fail | |
| Stage 3 web (V3.1–3.2 script; V3.3 browser) | ☑ Pass | V3.3 browser drills (MAN-301…309) done by reviewer 2026-07-21 |
| Stage 4 E2E (browser) | ☑ Pass | MAN-401 done by reviewer 2026-07-21 |
| Stage 5 deploy (V5.1–5.2) | ☐ Pass ☐ Fail | |
| Cross-cutting (§8) | ☐ Pass ☐ Fail | |

**Overall:** ☐ Verified ☐ Verified with findings ☐ Failed
**Verifier:** __________ **Date:** __________

---

## 10. What to report back

For each divergence: the **stage/gate ID**, the **command**, the **expected**, the
**actual**, and whether it is a **spec-conformance** issue (a Must requirement not
met) or an **implementation-quality** issue. Findings against 🔶 OPEN items
(ASM-002/003) are design questions for the PO, not build defects — flag them as
such. Confirm the 8 logged deviations are acceptable or call out any you dispute.
