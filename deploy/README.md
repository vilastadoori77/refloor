# Stage 5 — Azure Deployment (`deploy/`)

Azure CLI scripts that port the local Inventory Flash replica to **the
reviewer's own Azure subscription**, per [`docs/spec/04-azure-deployment.md`](../docs/spec/04-azure-deployment.md).
Everything lands in **one resource group** — `rg-inventory-flash` — so teardown
is a single command (AZ-001).

> These scripts **never handle credentials** (AZ-063). You run `az login`
> yourself first; the scripts only assume an authenticated session and a
> selected subscription.

## Architecture deployed

Three separate Node 18+ App Services on one App Service plan, mirroring the
canvas diagram layer-for-layer:

| App Service (`<PREFIX>-…`) | Role | Notes |
|---|---|---|
| `-mock-bc`       | Mock BC API (the "Azure Middleware" box) | admin routes token-gated; optionally IP-restricted |
| `-inventory-svc` | Inventory Service + cache + refresh worker + `/healthz` | reads all secrets via Key Vault references |
| `-inventory-web` | React website (static SPA) | talks **only** to the service (WEB-003) |

Plus: Key Vault `kv-<PREFIX>-inventory`, Application Insights, an email alert,
and — on the paid tier — Azure Cache for Redis Basic C0.

## Prerequisites

- Azure CLI (`az`) logged in: `az login` then `az account set --subscription <id>` (AZ-063)
- `openssl`, `npm`, `zip` on PATH
- A **globally unique** `<PREFIX>` (becomes part of `*.azurewebsites.net`), lowercase letters/digits/hyphens, short enough that `kv-<PREFIX>-inventory` ≤ 24 chars (so `PREFIX` ≤ 11 chars)

## The two decision branches

| Decision | Flag | Options |
|---|---|---|
| DEC-001 cost tier | `--tier` | `free` → F1 plan + `CACHE_DRIVER=memory` · `paid` → B1 plan + Redis Basic C0 + `CACHE_DRIVER=redis` |
| DEC-002 auth      | `--auth` | `stub` → dev-stub login (non-production) · `entra` → Entra ID Easy Auth on the web app |

## Cost table (per DEC-001)

| Tier | Resources | Est. monthly | Trade-offs |
|---|---|---|---|
| **free** (`--tier free`) | F1 App Service plan, in-memory cache, App Insights (pay-as-you-go, ~$0 at low volume) | **~$0** | F1 has a 60 min/day CPU quota, **no Always-On** (app idles → in-memory cache resets, next refresh cycle repopulates — AZ-020), and health checks aren't acted on. Fine for a demo/replica. |
| **paid** (`--tier paid`) | B1 App Service plan (~$13/mo) + Azure Cache for Redis Basic C0 (~$16/mo) + App Insights | **~$16–30/mo** | Always-On keeps the refresh worker running; Redis survives restarts; health check enforced. Matches MAN-507's paid estimate. |

App Insights and outbound data are usage-based; both estimates assume the light
traffic of a replica. Confirm actuals in **Cost Analysis** after ~24 h (MAN-507).

## Run order

```bash
# 0. one-time, by you:
az login
az account set --subscription <your-subscription-id>

# 1. provision infrastructure (prints every resource URL at the end)
./provision.sh --prefix <unique> --region eastus --tier free --auth stub
#   paid + entra example:
#   ./provision.sh --prefix <unique> --tier paid --auth entra

# 2. build + deploy the three apps
./deploy-apps.sh --prefix <unique>

# 3. wire the refresh-failure email alert
./alerts.sh --prefix <unique> --alert-email you@example.com

# …verify (below)…

# 4. tear everything down when done
./teardown.sh                 # interactive confirm; add --purge-kv to free the vault name
```

All parameters can be given as flags **or** environment variables
(`PREFIX`, `REGION`, `TIER`, `AUTH`, `ALERT_EMAIL`). Re-running `provision.sh`
is safe — it creates-if-absent and updates settings in place.

### Optional hardening flags

- `provision.sh --mock-cidr <a.b.c.d/32>` — IP-restrict the mock site to your
  address (admin routes are always token-gated regardless; AZ-011a).
- `provision.sh` env `AAD_CLIENT_ID=<appId>` — reuse an existing Entra app
  registration for Easy Auth instead of creating one (needs directory rights).

## Verification — maps to the Stage 5 manual drills

| Case | What to check | Backed by |
|---|---|---|
| **MAN-501** | All three URLs load over **HTTPS**; web renders both screens from live cloud data | AZ-005 https-only on all apps; AZ-012 service URL injected at build |
| **MAN-502** | Browser Network tab shows only web ↔ service traffic | web built with `VITE_API_BASE_URL` = service URL; mock URL never reaches the browser |
| **MAN-503** | Service starts; App-Service **app settings show `@Microsoft.KeyVault(...)` references**, no plaintext secret; admin endpoints not open | AZ-010/011a — KV references + managed identity; `ADMIN_TOKEN` + `ADMIN_API_REQUIRE_TOKEN=true` |
| **MAN-504** | Trigger mock outage (token-gated admin route) → App Insights logs failures → **alert email arrives** → site serves stale snapshot → recovery; `/healthz` stays green | AZ-040 App Insights, AZ-041 email alert, AZ-042 health check |
| **MAN-508** | Full cloud E2E click-through (filter, shortage, project callout, cache-only refresh, Inventory Status, outage/restore) over HTTPS | whole stack |
| **MAN-505** | `stub` → dev-stub login present & labeled non-production · `entra` → Easy Auth gates the web app, no React change | AZ-030 / AZ-031 |
| **MAN-506** | `./teardown.sh` → `az group show` returns **not found** | AZ-062 |
| **MAN-507** | Cost Analysis after ~24 h matches the tier estimate above | DEC-001 / AZ-020/021 |

To confirm **MAN-503** quickly:

```bash
az webapp config appsettings list -g rg-inventory-flash -n <PREFIX>-inventory-svc \
  --query "[?contains(value,'KeyVault')].name" -o tsv
# expect: ADMIN_TOKEN, BC_AUTH_TOKEN, (REDIS_URL on paid) — all via references
```

## Teardown note

`teardown.sh` runs `az group delete` on `rg-inventory-flash` after you type the
group name to confirm. Because **every** provisioned resource lives in that one
group, this leaves zero resources (MAN-506). Key Vault soft-delete may retain
the vault name for the retention window — pass `--purge-kv` to purge it so the
name is immediately reusable. Use `--no-wait` to return immediately (verify
later with `az group show --name rg-inventory-flash`).

## Requirement coverage

`provision.sh` → AZ-001/002/003/004/005/010/011/011a/020/021/030/031/040/042/060 ·
`deploy-apps.sh` → AZ-012/061 · `alerts.sh` → AZ-041 · `teardown.sh` → AZ-062 ·
this file → AZ-064. Optional AZ-050 (custom domain) and AZ-051 (GitHub Actions
CI) are **not** implemented — both are Priority **Could** in the spec.
