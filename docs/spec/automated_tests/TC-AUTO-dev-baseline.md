# Automated — Developer Experience Baseline

Traces: TEST-001, TEST-002 · SPEC 05 §1 · SPEC 00 §8 (repo layout).
Target: repo root scripts and a clean checkout. Run in CI and locally.

---

## TEST-001 — Single-command install & run

| Field | Value |
|---|---|
| **Traces** | TEST-001, SVC-010, MOCK-001, WEB-001, repo layout SPEC 00 §8 |
| **Priority** | Must |
| **Type** | Smoke / scripted |
| **Preconditions** | Clean working tree, Node 18+ installed, no services running on 4000/4100/5173 |

**Steps**
1. From repo root run `npm install`.
2. Run `npm run dev`.
3. Poll `http://localhost:4000/BC/GetInventory`, `http://localhost:4100/api/status`, `http://localhost:5173/` until each answers or a 30 s timeout elapses.
4. Run `npm test` in a second shell.
5. Stop `npm run dev` (SIGINT).

**Expected**
- `npm install` completes with exit 0 and hydrates all three workspaces (`mock-bc-api`, `inventory-service`, `inventory-web`).
- `npm run dev` brings up mock (4000), service (4100), web (5173) concurrently; all three probes return 2xx within the timeout.
- `npm test` runs the full unit + contract suite and exits 0.
- No port-in-use or missing-dependency errors in output.

**Evidence:** captured stdout of `npm run dev` showing all three ports bound.

---

## TEST-002 — Fresh-clone / no-global-tools

| Field | Value |
|---|---|
| **Traces** | TEST-002 |
| **Priority** | Must |
| **Type** | Environment isolation |
| **Preconditions** | A machine (or clean container) with **only** Node 18+ — no Docker, no Azure CLI, no globally installed build tools |

**Steps**
1. `git clone` the repo into an empty directory.
2. `npm install` at root.
3. `npm run dev` and `npm test` per TEST-001.

**Expected**
- Everything in TEST-001 passes with no additional prerequisites.
- No step requires Docker, a database server, an Azure login, or a globally installed CLI.

**Notes:** this is the guard against "works on my machine" drift. If CI uses a bare `node:18` image with no extra layers, that satisfies this case.

---

## TEST-001.2 — Workspace wiring sanity

| Field | Value |
|---|---|
| **Traces** | SPEC 00 §8, TEST-001 |
| **Priority** | Should |
| **Type** | Static |

**Steps**
1. Assert root `package.json` declares `workspaces` covering the three package dirs.
2. Assert each workspace has a `dev`, `build`, and `test` script.
3. Assert TypeScript is the language in all three (`tsconfig.json` present) — PB-007 decision.

**Expected:** all assertions hold; `npm test` discovers suites in service and mock workspaces.
