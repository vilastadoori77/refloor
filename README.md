# Inventory Availability Flash — Local / Azure Replica

A layer-for-layer replica of the Refloor **Inventory Availability Flash**
architecture: a mock Business-Central middleware, an inventory service that
consolidates + caches + refreshes the data, and a React website that mirrors the
two Power BI screens. Built to the spec suite in [`docs/spec/`](docs/spec/).

> **Replica ≠ production.** Auth (Salesforce SSO) and the data source (`dev.myx.ac`)
> are substituted; sale headers are mock-only; the availability thresholds
> (ASM-002/003) ship as **configurable defaults** pending Product-Owner
> confirmation. See [`docs/spec/00-overview.md`](docs/spec/00-overview.md) §1/§4
> and [`docs/spec/decisions-log.md`](docs/spec/decisions-log.md).

## Architecture

```
Browser ──/api/*──▶ inventory-service ──/BC/*──▶ mock-bc-api ──▶ generated dataset
(React)             (consolidate+cache+             (stands in for Azure
                     refresh+health)                 Middleware + Business Central)
```

Invariant: the website talks **only** to the service; only the service's refresh
job calls the mock middleware; the middleware URL/credential never reaches the
browser.

| Workspace | Role | Port (dev) |
|---|---|---|
| `mock-bc-api` | Mock BC / middleware (SPEC 01) | 4000 |
| `inventory-service` | Service + cache + refresh + health (SPEC 02) | 4100 |
| `inventory-web` | React website (SPEC 03) | 5173 |
| `shared` | Shared TypeScript contract compiled across service + web (PB-007) | — |

## Run it (Node 18+ only — no Docker, no Azure)

```bash
npm install      # once, at repo root (npm workspaces)
npm run dev      # starts mock (4000) + service (4100) + web (5173) concurrently
```

Open http://localhost:5173. Sign in at the dev-stub gate (name only — not
production auth). Individual apps: `npm run dev:mock` / `dev:svc` / `dev:web`.

## Test

```bash
npm test         # Vitest: unit (service) + contract (mock) suites
```

Test cases and their traceability live in
[`docs/spec/automated_tests/`](docs/spec/automated_tests/) (machine-run) and
[`docs/spec/manual_tests/`](docs/spec/manual_tests/) (reviewer checkpoint drills).

## Configuration (business rules are config, not code — PB-001)

Availability formula, color thresholds, project-status logic, and refresh
interval all read from one config object (`shared` `DEFAULT_CONFIG`, overridable
at runtime via `PUT /api/admin/config`). Nothing business-related is hard-coded.

| Env | Default | Purpose |
|---|---|---|
| `MOCK_PORT` | 4000 | Mock server port |
| `MOCK_SEED` | 42 | Deterministic dataset seed |
| `PORT` | 4100 | Service port |
| `BC_BASE_URL` | http://localhost:4000 | Middleware base (repoint to real `dev.myx.ac` here) |
| `BC_AUTH_TOKEN` | — | Injected into `/BC/*` requests when set; never exposed |
| `REFRESH_SECONDS` | 60 (local) / 300 (Azure) | Refresh cadence, runtime-mutable |
| `CACHE_DRIVER` | memory | `memory` or `redis` (`REDIS_URL`) |
| `WEB_ORIGIN` | http://localhost:5173 | CORS allowlist for the service |
| `ADMIN_TOKEN` | — | Required for admin endpoints when `NODE_ENV=production` |

## Pointing at real middleware later (SVC-043 — scoped honestly)

The three cacheable feeds (`GetInventory`, `GetPurchaseOrders`, `Demand`) and the
per-project fetch are config-swap ready: set `BC_BASE_URL` + `BC_AUTH_TOKEN`. The
**sale-header list is replica-only** (mock `_mock/GetProjects`, no real source) and
will not swap until a genuine sale-header source exists.

## Azure deployment (Stage 5)

Scripts in [`deploy/`](deploy/) provision three App Services in one resource group.
Run `az login` yourself first, then `deploy/provision.sh`, `deploy/deploy-apps.sh`.
Cost per tier and teardown (`deploy/teardown.sh` → `az group delete`) are in
[`deploy/README.md`](deploy/README.md). Two choices before deploying: DEC-001
(cost tier) and DEC-002 (auth).

## Credentials

No credential from the source documents appears anywhere in this repo (MOCK-005);
secrets on Azure live in Key Vault. Verified by grep in the test suite.
