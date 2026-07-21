# Manual — Stage 5 Checkpoint: Azure Deployment

Gate: the working local stack is ported to the reviewer's Azure subscription.
Traces: SPEC 04 §7 acceptance + TEST-035 (cloud repeat of the outage + E2E drills).
Blocked on: Stage 4 accepted + **DEC-001** (cost tier) + **DEC-002** (auth) chosen.

**Preconditions:** reviewer has run `az login`; `deploy/provision.sh` +
`deploy/deploy-apps.sh` executed; three app URLs printed.

---

## MAN-501 — All three apps reachable over HTTPS; web renders live cloud data

| Field | Value |
|---|---|
| **Traces** | AZ-002/005, AZ-012, SPEC 04 §7 bullet 1 |
| **Priority** | Must |

**Steps:** open the web app URL; exercise both screens.
**Expected:** all three App Services (`mock-bc`, `inventory-svc`, `inventory-web`) reachable over **HTTPS only**; both screens render from live cloud data.
**Result:** ☐ Pass ☐ Fail — URLs: ____

---

## MAN-502 — Cloud isolation invariant holds

| Field | Value |
|---|---|
| **Traces** | WEB-003, AZ-012, SPEC 04 §7 bullet 2 |
| **Priority** | Must |

**Steps:** dev-tools Network during a full cloud click-through.
**Expected:** only `inventory-web ↔ inventory-service` traffic; no direct calls to the mock/middleware from the browser.
**Result:** ☐ Pass ☐ Fail — HAR: ____

---

## MAN-503 — Key Vault reference resolves; no plaintext secret

| Field | Value |
|---|---|
| **Traces** | AZ-010, AZ-011a, SPEC 04 §7 bullet 3 |
| **Priority** | Must |

**Steps**
1. Confirm the service starts and reads `BC-AUTH-TOKEN` / `REDIS-URL` / `ADMIN_TOKEN` via Key Vault references + managed identity.
2. Inspect App Service application settings.

**Expected:** service healthy; **no secret value in plaintext** app settings; admin guard (SVC-045) enabled so `PUT /api/admin/config` + `POST /api/admin/refresh` are not open on the public internet; mock admin routes not publicly exposed.
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-504 — Cloud outage drill + alert email (TEST-035 part A)

| Field | Value |
|---|---|
| **Traces** | AZ-040/041/042, SVC-014, MOCK-070, TEST-035, SPEC 04 §7 bullet 4 |
| **Priority** | Must |

**Steps**
1. Trigger mock outage in cloud (admin route, IP-restricted).
2. Wait for `consecutiveFailures ≥ 3`.
3. Watch App Insights + the reviewer's inbox.
4. Confirm the site serves the stale snapshot meanwhile.
5. Disable outage → recovery.

**Expected:** App Insights logs the failure; **alert email arrives** at the reviewer address (Azure Monitor action group); site keeps serving last-good; recovery after outage off. `/healthz` health check green throughout (AZ-042).
**Result:** ☐ Pass ☐ Fail — email evidence: ____

---

## MAN-508 — Cloud E2E repeat of TEST-034 (TEST-035 part B) ⭐

| Field | Value |
|---|---|
| **Traces** | TEST-035, TEST-034, WEB-006, ASM-007, SVC-042a, SPEC 04 §7 |
| **Priority** | Must |

**Why this exists:** SPEC 05 TEST-035 requires a **cloud repeat of TEST-030 + TEST-034**. MAN-504 covers the outage/email half (TEST-030). This case covers the full local E2E half on Azure.

**Scripted flow (one continuous cloud session — same steps as MAN-401)**
1. Filter a satellite → colored grouped grid.
2. Find a shortage item (yellow/red).
3. Open MOCK-045(e) project → gold callout.
4. Header refresh → **cache-only** (no `POST /api/admin/refresh`; `refreshedAt` not force-advanced).
5. Inventory Status → shortage board **and** health widget (ASM-007 = Both).
6. Enable mock outage (or stop mock) → wait a cycle → stale-but-served on satellite views; health loud; project fetch **503**.
7. Restore → recovery; `refreshedAt` advances.

**Expected:** every step passes over HTTPS against the cloud apps; browser network shows only web ↔ service traffic (same invariant as MAN-502).
**Result:** ☐ Pass ☐ Fail — session evidence: ____

---

## MAN-505 — Auth branch (DEC-002)

| Field | Value |
|---|---|
| **Traces** | AZ-030/031 |
| **Priority** | Must |

**Expected (per chosen branch)**
- DEC-002a: dev-stub login present, clearly labeled non-production.
- DEC-002b: Entra ID Easy Auth on `inventory-web` gates access; no React code change.

**Result:** ☐ Pass ☐ Fail — branch: ____

---

## MAN-506 — Teardown leaves zero resources

| Field | Value |
|---|---|
| **Traces** | AZ-001, AZ-062, SPEC 04 §7 bullet 5 |
| **Priority** | Must |

**Steps:** run `deploy/teardown.sh` (confirm) → `az group delete` on `rg-inventory-flash`.
**Expected:** the resource group and everything in it is gone; `az group show` returns not-found.
**Result:** ☐ Pass ☐ Fail — ____

---

## MAN-507 — Cost matches DEC-001 estimate

| Field | Value |
|---|---|
| **Traces** | DEC-001, AZ-020/021, SPEC 04 §7 bullet 6 |
| **Priority** | Should |

**Steps:** after ~24 h, check Cost Analysis for the resource group.
**Expected:** monthly projection matches the chosen tier — (a) Free ~$0 or (b) B1 + Redis Basic C0 ~$16–30/mo.
**Result:** ☐ Pass ☐ Fail — observed: ____

---

### Stage 5 sign-off

☐ All Must cases pass · Reviewer: ______ · Date: ______ · Project accepted: ☐ Yes ☐ No
