# SPEC 04 — Azure Infrastructure & Deployment (Stage 5)

Ports the working local stack to the reviewer's own Azure subscription,
mirroring the spec'd hosting requirements with the approved substitutions.
All provisioning via **Azure CLI scripts in `deploy/`** — reviewable before running,
re-runnable (idempotent where the CLI allows).

Blocked on: local stack accepted (Stage 4) + DEC-001 (cost tier) + DEC-002 (auth).

---

## 1. Resource topology

| ID | Pri | Requirement |
|---|---|---|
| AZ-001 | M | One resource group `rg-inventory-flash` (region: reviewer's choice, default `eastus`) containing everything — single-command teardown (`az group delete`) must fully clean up. |
| AZ-002 | M | **Three App Services** (one plan): `mock-bc-api`, `inventory-service`, `inventory-web` — preserving the architecture's separation; the mock occupies the "Azure Middleware" box as a genuinely separate deployable. |
| AZ-003 | M | App Service plan tier per DEC-001: F1 (free) or B1 (paid). Node 18+ runtime. |
| AZ-004 | M | Names: `<prefix>-mock-bc`, `<prefix>-inventory-svc`, `<prefix>-inventory-web` where `<prefix>` is reviewer-chosen (global uniqueness). Substitutes for `inventory.refloor.com`; custom domain optional (AZ-050). |
| AZ-005 | M | **HTTPS only** enforced on all three (satisfies the SSL requirement; `*.azurewebsites.net` certs are automatic). |

## 2. Configuration & secrets

| ID | Pri | Requirement |
|---|---|---|
| AZ-010 | M | **Azure Key Vault** `kv-<prefix>-inventory` holds: `BC-AUTH-TOKEN` (placeholder value in replica), `REDIS-URL` (if DEC-001b). App Services read via Key Vault references + system-assigned managed identities — no secret in app settings plaintext. |
| AZ-011 | M | Service app settings: `BC_BASE_URL` = mock app URL, `REFRESH_SECONDS=300`, `WEB_ORIGIN` = web app URL, `CACHE_DRIVER` per DEC-001. Changing any app setting must not require redeploying code (satisfies "configurable without deployment"). |
| AZ-011a | M | **Admin-endpoint secret (PB-007 / SVC-045):** `ADMIN_TOKEN` stored in Key Vault and referenced by the service app; the production admin guard (SVC-045) is enabled so `PUT /api/admin/config` and `POST /api/admin/refresh` are not open mutation surfaces on the public internet. The mock's `/admin/outage` endpoints are likewise not exposed publicly (mock app kept internal / IP-restricted, or its admin routes gated by the same token). |
| AZ-012 | M | Web build receives the service URL at build time (env) or via same-origin reverse proxy — either way WEB-003 holds in cloud. |

## 3. Cache (DEC-001 branch)

| ID | Pri | Requirement |
|---|---|---|
| AZ-020 | M | DEC-001a (free): `CACHE_DRIVER=memory` — spec-compliant via SVC-020 alternative; documented limitation: cache resets on app restart, next refresh cycle repopulates. |
| AZ-021 | M | DEC-001b (paid): **Azure Cache for Redis** Basic C0, TLS only, connection string in Key Vault, `CACHE_DRIVER=redis`. |

## 4. Monitoring & alerts

| ID | Pri | Requirement |
|---|---|---|
| AZ-040 | M | **Application Insights** connected to `inventory-service` (SVC-034); mock + web optional. |
| AZ-041 | M | **Email alert** (ASM-010): Azure Monitor alert rule on refresh-failure signal (custom event or trace query, `consecutiveFailures ≥ 3`) → action group emailing the reviewer's address. Fulfills the docx "Email alerts" must-have. |
| AZ-042 | M | App Service health check pointed at `/healthz` (SVC-033) on the service app. |

## 5. Auth (DEC-002 branch)

| ID | Pri | Requirement |
|---|---|---|
| AZ-030 | M | DEC-002a: dev-stub login stays (clearly labeled non-production). |
| AZ-031 | M | DEC-002b: **Entra ID** via App Service built-in authentication (Easy Auth) on `inventory-web` — free-tier Entra, no code change to the React app; occupies the diagram's SSO layer position exactly. |

## 6. Deployment mechanics

| ID | Pri | Requirement |
|---|---|---|
| AZ-060 | M | `deploy/provision.sh` — creates all resources; parameters at top (prefix, region, tier flags). Prints every resource URL at the end. |
| AZ-061 | M | `deploy/deploy-apps.sh` — builds and zip-deploys all three apps (`az webapp deploy`); React built with production env. |
| AZ-062 | M | `deploy/teardown.sh` — deletes the resource group after confirmation. |
| AZ-063 | M | Reviewer runs `az login` themselves; scripts never handle credentials interactively. |
| AZ-064 | S | `deploy/README.md` — cost table per tier, run order, verification steps. |
| AZ-050 | C | Optional custom domain + managed cert on `inventory-web`. |
| AZ-051 | C | Optional CI: GitHub Actions workflow deploying on push to `main`. |

## 7. Acceptance criteria (Stage 5 checkpoint)

- [ ] All three apps reachable over HTTPS; web app renders both screens from live cloud data.
- [ ] Browser network tab in cloud: only `inventory-web` ↔ `inventory-service` traffic (invariant holds).
- [ ] Key Vault reference resolves (service starts with no plaintext secret in app settings).
- [ ] Outage drill in cloud: mock outage on → App Insights logs failure, alert email arrives, site serves stale snapshot; outage off → recovery.
- [ ] `teardown.sh` leaves zero resources behind.
- [ ] Monthly cost matches the DEC-001 estimate (verified in Cost Analysis after 24 h).
