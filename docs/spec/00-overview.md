# SPEC 00 — Overview, Scope & Traceability

**Project:** Inventory Availability Flash — Local Replica & Azure Port
**Spec version:** 1.2-draft (v1.2 syncs specs to reviewer decisions in `decisions-log.md`)
**Sources:** `React Inventory Website Requirements.docx`, `API_React Inventory Website Requirements.docx`, 3 embedded screenshots, `docs/architecture/inventory-architecture.canvas.tsx`, `docs/spec/06-accuracy-review-pushback.md`, `docs/spec/decisions-log.md`
**Status:** ⏳ Awaiting reviewer approval — nothing is built until this spec suite is approved.

---

## 1. Purpose

Build a **layer-for-layer replica** of the Refloor Inventory Availability Flash
architecture on the reviewer's own machine and Azure subscription, substituting
the components that are Refloor property (per substitution/omission list §4).

**Replica ≠ production (PB-006):** this suite specifies a personal/local replica.
It is **not** a Refloor production-cutover spec — production would additionally
require real Salesforce SSO, the real `dev.myx.ac` credentials, a confirmed
sale-header source, and Product-Owner-confirmed business math (the OPEN items
in §5). Nothing in this suite may be represented as "exact production behavior."

## 2. Spec suite structure

| Doc | Component | Requirement prefix |
|---|---|---|
| [00-overview.md](00-overview.md) | Scope, assumptions, decisions, traceability | ASM / DEC |
| [decisions-log.md](decisions-log.md) | Reviewer / PO decisions on OPEN items | — |
| [01-mock-bc-api.md](01-mock-bc-api.md) | Mock BC API (stands in for Azure Middleware + Business Central) | MOCK |
| [02-inventory-service.md](02-inventory-service.md) | Inventory Service (service + cache + refresh job + health) | SVC |
| [03-react-website.md](03-react-website.md) | React Inventory Website (UI) | WEB |
| [04-azure-deployment.md](04-azure-deployment.md) | Azure infrastructure & deployment | AZ |
| [05-testing-acceptance.md](05-testing-acceptance.md) | Test plan & acceptance criteria | TEST |
| [06-accuracy-review-pushback.md](06-accuracy-review-pushback.md) | Accuracy review & pushbacks | PB |

Every requirement has a unique ID (`SVC-012`), a priority (**M**ust / **S**hould /
**C**ould), and is traceable back to a source (§7). Review = approve, amend, or
strike each ID.

## 3. Architecture (target, mirrors the canvas diagram 1:1)

```
Layer 1  Users            → reviewer + invited users            [role replicated]
Layer 2  Auth             → Dev-stub (local) / Entra ID (Azure) [substitute for Salesforce SSO]
Layer 3  UI               → React Inventory Website             [BUILD — exact]
Layer 4  Service          → Inventory Service                   [BUILD — exact]
Layer 5  Cache + Refresh  → Snapshot cache + Refresh Job        [BUILD — exact]
Layer 6  Integration      → Mock BC API                         [substitute for Azure Middleware]
Layer 7  Source           → Mock's generated dataset            [substitute for Business Central]
```

**Invariant (from diagram callout), non-negotiable:**
- The Website talks **only** to the Inventory Service (`/api/*`).
- Only the Refresh Job calls the (mock) middleware endpoints.
- The Website never receives or knows the middleware URL or credential.

## 4. Approved substitutions (agreed in conversation)

| Real component | Replica | Rationale |
|---|---|---|
| Business Central | Generated dataset inside Mock BC API | Refloor ERP, no access; BC is only ever reached via middleware |
| Azure Middleware APIs (`dev.myx.ac`) | Mock BC API — same paths, same JSON shapes | Refloor service + credential |
| Salesforce SSO | Dev-stub locally; Microsoft Entra ID on Azure (DEC-002) | Refloor Salesforce org |
| `inventory.refloor.com` | `*.azurewebsites.net` (or reviewer's domain) | Refloor domain |

**Deliberate omissions** (documented per PB-005 — not claimed as "exact per docx"):

| Docx requirement | Replica treatment | Rationale |
|---|---|---|
| Cache: SQL Server alternative | **Not implemented** — cache drivers are in-memory + Redis only (SVC-020) | The docx's Redis-preferred option is implemented for real; a third driver adds no architectural fidelity to a replica. The store interface keeps a SQL driver addable later. |
| Sale headers / "Picked" source | Mock-only endpoint (MOCK-060) / constant 0 | No real source API exists — see ASM-004/005 and SVC-043 |

Everything else is built for real, not simulated.

## 5. Assumptions & open business rules

Each ASM is used by later specs. The **Status** column is the key change from
v1.0 (per PB-001/PB-004): assumptions are split into two classes.

- **REPLICA-SCOPING** — a decision about how the *replica* stands in for a
  missing/Refloor-owned piece. Approving this doc approves these.
- **OPEN — needs Product Owner** — an inferred **business rule** the source
  documents never defined. These are **NOT locked truth.** They ship as
  **configurable defaults** (values in config, changeable at runtime — SVC-003 /
  SVC-011), never as hard-coded Must logic, and must be confirmed by Michael
  Agrusso / Jay Wolgin before the replica's numbers can be trusted as accurate.

> **PB-001 resolution:** ASM-001/002/003 were **explicitly not** approved as fact
> by the spec text alone. They are inferred from the API fields and screenshots so
> that the replica has *some* defensible behavior to render. Building against them
> is safe **because they are isolated and configurable**, not because they are
> known correct.

> **Reviewer decisions (2026-07-21) — logged in [`decisions-log.md`](decisions-log.md):**
> **ASM-001 selected** (Available = OnHand − Allocated) · **ASM-007 = Both**
> (shortage board + health widget) · **WEB-006 = cache-only reload**.
> **ASM-002 and ASM-003 remain 🔶 OPEN.** A reviewer decision is the reviewer's
> call; PO ratification is still advisable before the numbers are treated as
> production-accurate (reviewer ≠ Product Owner unless confirmed).

| ID | Class | Assumption / rule |
|---|---|---|
| ASM-001 | ✅ **DECIDED (reviewer, 2026-07-21)** | **Availability formula (selected; still configurable):** On Hand = `qoh`; Allocated = Σ`demand` (item+location); Ordered = Σ`qpo`; **Available = On Hand − Allocated**; Available (ft²) = Available × `sqftPerCase`. ⚠️ This selected default **ignores Ordered/`onPO`**, whereas the API's own `netInventory = qoh + onPO − demand` includes it — the satellite grid may diverge from the real Power BI numbers; PO ratification advisable. The consolidator still exposes the formula as a named strategy, so the `qoh + onPO − demand` alternative stays a config switch, not a rewrite. |
| ASM-002 | 🔶 **OPEN — needs PO** | **Color thresholds (satellite grid), configurable:** red if Available < 0; yellow if 0 ≤ Available < 25% of Allocated (min 10 units when Allocated = 0 → yellow if Available < 10); green otherwise. Power BI's actual thresholds are unknown; these are placeholders tunable via SVC-003 config with no redeploy. |
| ASM-003 | 🔶 **OPEN — needs PO** | **Project item status (default, configurable):** Ready (green check) if Available ≥ Required; Attention (yellow) if Available < Required but Available + Ordered ≥ Required; Short (red) otherwise. Remainder = Required − Picked. Same config-strategy treatment as ASM-001. |
| ASM-004 | ✅ REPLICA-SCOPING | **Picked** has no source API → always `0.00` in replica, column still displayed. |
| ASM-005 | ✅ REPLICA-SCOPING | **Sale headers** (Sale #, Customer, BC Status, File Status, Install Date) have no source API → Mock BC API provides a mock-only endpoint (MOCK-060) clearly marked non-canonical. Replica-only; see SVC-043. |
| ASM-006 | ✅ REPLICA-SCOPING | **"Item Details"** menu entry (screenshot-only, not in written nav spec) → rendered in the menu but disabled/greyed (as in screenshot), no screen behind it in v1. |
| ASM-007 | ✅ **DECIDED (reviewer, 2026-07-21) = Both** | **"Inventory Status"** nav item (spec'd, never defined — no screenshot). **Reviewer decision:** build **both** — an **operational shortage board** as the main screen (items/projects below threshold across all satellites, on `/api/inventory` data) **plus** the **service health / refresh status** relocated to a smaller widget. Supersedes the earlier health-page-only working assumption; see WEB-060…063. |
| ASM-008 | ✅ REPLICA-SCOPING | **Locations:** 8 satellites — Charlotte/CHA, Detroit/DET, Cincinnati/CIN, Chicago/CHI, Columbus/COL, Grand Rapids/GRR, Cleveland/CLE, Indianapolis/IND. (Real data shows Grand Rapids under code DET; replica keeps 1:1 code↔name and covers the mismatch in test data instead, MOCK-045.) |
| ASM-009 | ✅ REPLICA-SCOPING | **Refresh interval:** default 300 s (spec) but local dev default 60 s for feedback speed; both runtime-configurable (SVC-011). |
| ASM-010 | ✅ REPLICA-SCOPING | **Email alerts** replicated as: pluggable alert sink — console/log locally, Azure Monitor alert → email on Azure (AZ-041). No SMTP server built. |

**Build guardrail (PB-001):** No business rule (the now-DECIDED ASM-001 and the
still-🔶-OPEN ASM-002/003) may be hard-coded as branch logic in the consolidator
or UI. Each must read from the config object (default values above) so a PO
correction — or a change to the ASM-002/003 defaults still pending — is a config
edit, enforced by TEST-011/013/016 reading the same config and by the deviation
rule (SPEC 05 §6).

## 6. Decisions deferred to Stage 5 (do not block build)

| ID | Decision | Options |
|---|---|---|
| DEC-001 | Azure cost tier | (a) Free: F1 App Services + in-memory cache, $0/mo · (b) Paid: B1 + Azure Cache for Redis Basic C0, ~$16–30/mo |
| DEC-002 | Azure auth | (a) Dev-stub login · (b) Entra ID (free tier) |

## 7. Traceability matrix (source → spec)

| Source requirement | Spec IDs |
|---|---|
| **Docx — Service responsibilities** (retrieve ×4, consolidate, calculate, cache, refresh, expose APIs, monitor) | SVC-001…SVC-034 |
| **Docx — Website responsibilities** (by satellite, by project, search, filter, readiness, status, last refresh) | WEB-020…WEB-062 |
| **Docx — Source API contracts** (4 endpoints + response shapes) | MOCK-010…MOCK-052 |
| **Docx — Cache Refresh must-haves** (configurable, logging, retry, last-good) | SVC-010…SVC-014 |
| **Docx — Cache Storage must-haves** (Redis/SQL, atomic, timestamp) | SVC-020…SVC-023 |
| **Docx — API Health must-haves** (logging, alerts, dashboard) | SVC-030…SVC-034 |
| **Docx — Technical** (SSO, App Service, SSL, Key Vault, App Insights, Redis/SQL, 5-min configurable) | AZ-001…AZ-051, SVC-011 |
| **Docx — UI section + Screenshot 1** (satellite screen) | WEB-020…WEB-034 |
| **Docx — UI section + Screenshot 2** (project screen) | WEB-040…WEB-057 |
| **Screenshot 3** (brand palette) | WEB-010…WEB-014 |
| **Canvas diagram — layers, arrows, callout** | §3 invariant, SVC-040…SVC-042, WEB-003 |
| **Canvas diagram — build checklist (10 bullets)** | covered: SVC-001/002/020/010/040 · WEB-020/040/060/010/030/AZ-001 |
| **Conversation — mock outage switch, edge-case data** | MOCK-070…MOCK-072, MOCK-040…MOCK-046 |
| **Conversation — single-command local run** | TEST-001, repo layout §8 |

## 8. Repository layout (target)

```
_refloor/
├── docs/                  (requirements, build plan, architecture, this spec suite)
├── mock-bc-api/           Node 18+ · Express · port 4000
├── inventory-service/     Node 18+ · Express · port 4100
├── inventory-web/         React 18 · Vite · port 5173 (dev)
├── deploy/                Azure CLI scripts (Stage 5)
└── package.json           npm workspaces · `npm run dev` starts all three
```

## 9. Out of scope for v1 (explicit)

- Real Salesforce SSO; real `dev.myx.ac` as the live data source (SVC-043: the three cacheable feeds + per-project items are config-swap ready; sale headers / `/api/projects` list are **not** — replica-only via MOCK-060 until a real source exists)
- Item Details screen (ASM-006), picked-quantity sourcing (ASM-004)
- Write operations of any kind — the entire system is read-only
- Mobile-native apps (responsive web only)
- Power BI decommissioning (nothing to do in replica)
