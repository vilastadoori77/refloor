# SPEC 06 — Accuracy Review & Pushbacks

**Author:** Cursor agent review (conversation)
**Date:** 2026-07-21
**Sources reviewed:**
- `React Inventory Website Requirements.docx`
- `API_React Inventory Website Requirements.docx`
- `docs/requirements-consolidated.md`
- `docs/build-plan.md`
- `docs/architecture/inventory-architecture.canvas.tsx`
- Spec suite: `00-overview.md` … `05-testing-acceptance.md`

**Purpose:** Record readings and pushbacks against the draft spec suite before build approval. Companion canvas (IDE only): Cursor canvases `spec-accuracy-review.canvas.tsx`.

**Status:** Review notes — does not approve or strike requirement IDs. Specs change by review, not silently in code (see SPEC 05 deviation rule).

> **✅ 2026-07-21 — All seven pushbacks addressed in spec text (suite v1.0 → v1.1).**
> See [`CHANGELOG.md`](CHANGELOG.md) for the per-PB resolution.
>
> **✅ 2026-07-21 — Minor consistency cleanups (suite v1.1 → v1.1.1).**
> SPEC 06 body refreshed to match resolved state; SPEC 00 §9 and SVC-020
> wording aligned with SVC-043 / SQL omission. See CHANGELOG.
>
> **✅ 2026-07-21 — Reviewer decisions synced (suite v1.1.1 → v1.2).**
> Specs aligned to [`decisions-log.md`](decisions-log.md): ASM-001, ASM-007,
> WEB-006 decided; SPEC 03 §5 rewritten (WEB-060…063); SVC-002 / SPEC 06
> checklist updated. Still OPEN: ASM-002, ASM-003.

---

## 1. Overall verdict (current — suite v1.2)

The spec suite is a **strong, honest plan for a local/Azure replica** of the
Inventory Availability Flash architecture. Architecture boundaries, the four
middleware contracts, and cache/refresh/health/hosting must-haves are solid.

**Reviewer decisions logged** (ASM-001 formula, ASM-007 = Both, WEB-006 =
cache-only) unblock Inventory Status and refresh UX for build. **ASM-002**
(color thresholds) and **ASM-003** (project item status) remain 🔶 OPEN —
configurable placeholders until PO confirms.

**Replica ≠ production:** Do not treat this suite as ready for Refloor
production cutover until Salesforce SSO, real middleware credentials, a
sale-header source, and PO-ratified business math are resolved with Product
Owner / IT.

**Approval stance:** Fine to approve Stages 1–3 for the replica against the
decided defaults + OPEN placeholders for ASM-002/003.

---

## 2. Accuracy scorecard (post v1.2)

| Layer | Score | Standing |
|---|---|---|
| Architecture layers & invariants | **High (~90%)** | Faithful; replica framing clear |
| Source API shapes & paths | **High (~90%)** | Matches API docx samples; contract tests planned |
| Service must-haves (cache / refresh / health) | **High (~90%)** | Traceable; project-fetch intentional (SVC-001a); SQL omission documented |
| UI structure / brand / screenshots | **Medium–High (~85%)** | Inventory Status defined (shortage + health); screenshot screens unchanged |
| Availability formula (ASM-001) | **Decided (reviewer)** | Configurable; PO ratification advisable |
| Color / project-status rules (ASM-002/003) | **OPEN (~configurable)** | Placeholders; PO confirmation still required |
| Auth & domain (production Refloor) | **N/A (substituted)** | Correct replica plan; not production-accurate |
| Real-middleware cutover (SVC-043) | **Honestly scoped** | Feeds + project items yes; sale headers no |
| **Overall (as a replica plan)** | **~90%** | Spec sync complete; two OPEN business rules remain |

---

## 3. Readings — what the specs got right

| Area | Verdict | Notes |
|---|---|---|
| Two-tier boundary | Accurate | Web → Service only; only refresh job hits `/BC/*` |
| 4 middleware contracts | Accurate | Paths, field names, `expected_Receipt_Date` casing, nullable `locationCode` |
| Cache refresh must-haves | Accurate | Configurable interval, retry, logging, keep last-good (SVC-010…014) |
| Cache storage | Accurate (replica) | Atomic swap + timestamp; Redis preferred; SQL deliberately omitted (§4) |
| API health | Accurate | Logging, alerts, dashboard status mapped cleanly |
| Hosting stack | Accurate (replica) | App Service, Key Vault, App Insights, SSL — with approved substitutions |
| UI shell from screenshots | Plausible | Satellites / Projects layout, columns, captions, brand hexes |
| Credential hygiene | Accurate | MOCK-005 + Key Vault; no docx token in repo |
| Gaps called out | Honest | Picked=0, sale headers mock-only, Item Details greyed |
| Spec status framing | Good | Awaiting reviewer approval; replica ≠ production |

### Architecture reading

```
Users → Auth → React Website → Inventory Service → Cache ← Refresh Job → Middleware/Mock → BC/Mock data
```

### API reading (aligned with API docx)

| Endpoint | Spec coverage | Match |
|---|---|---|
| `GET /BC/GetInventory` | MOCK-010 | Field-for-field with samples |
| `GET /BC/GetPurchaseOrders` | MOCK-011 | Includes `qpo`, `purchNo`, `expected_Receipt_Date` |
| `GET /BC/Demand` | MOCK-012 | Matches URL path; `netInventory` identity |
| `GET /BC/GetInventoryByProject/:projectNo` | MOCK-013 | Project envelope + demand-row items |

---

## 4. Pushbacks (historical) & resolution status

Each pushback has an ID (`PB-xxx`) for tracking in review / CHANGELOG.

| PB | Original severity | Spec resolution (v1.1) | Status |
|---|---|---|---|
| PB-001 | Blocker | ASM-001/002/003 → OPEN + configurable; later ASM-001 **reviewer-decided** | ✅ Spec closed; ASM-001 decided; ⏳ ASM-002/003 PO |
| PB-002 | Blocker | SVC-043 rescoped; sale headers replica-only | ✅ Closed |
| PB-003 | High | SVC-001a / SVC-042a / TEST-017 | ✅ Closed |
| PB-004 | High | ASM-007 → OPEN then **reviewer-decided = Both**; WEB-060…063 | ✅ Closed |
| PB-005 | Medium | Deliberate omissions table; SVC-020 aligned | ✅ Closed |
| PB-006 | Medium | Replica ≠ production; §9 cutover wording fixed | ✅ Closed |
| PB-007 | Low | TypeScript; SVC-045; WEB-009; WEB-006 **reviewer-decided** cache-only | ✅ Closed |

### Original ask detail (kept for audit trail)

#### PB-001 — Business math promoted from gap → Must (ASM-001…003)

Requirements never defined availability / thresholds / readiness. v1.0 locked
them as Must. **Risk:** Available = qoh − demand ignores Ordered while API
`netInventory` includes onPO. **Ask (met):** demote to OPEN + configurable
defaults.

#### PB-002 — “Zero-code swap to real middleware” overstated (SVC-043)

MOCK-060 sale headers have no real equivalent. **Ask (met):** feeds
swap-ready; sale headers replica-only.

#### PB-003 — Refresh drops “Retrieve project inventory”

Docx lists project inventory among responsibilities; refresh only pulls three
feeds. **Ask (met):** document intentional on-demand design + failure rules.

#### PB-004 — Inventory Status = health page is a guess (ASM-007)

Nav item undefined in requirements. **Ask (met):** mark OPEN; confirm with PO
before treating WEB-060…062 as the definition.

#### PB-005 — SQL Server alternative omitted

**Ask (met):** list as deliberate omission in §4; do not claim “exact per docx.”

#### PB-006 — “Exact architecture” vs auth/domain substitutions

**Ask (met):** replica ≠ production framing.

#### PB-007 — Smaller inconsistencies

JS vs TS → TypeScript; admin auth → SVC-045; RBAC deferred → WEB-009; manual
refresh → WEB-006 flagged 🔶 unconfirmed.

---

## 5. Safe-to-approve checklist

### Spec-text items (closed in v1.1 / v1.1.1 / v1.2)

- [x] **PB-001:** Demote ASM-001 / 002 / 003 to OPEN + configurable; ASM-001 later reviewer-decided
- [x] **PB-002:** Rewrite SVC-043 cutover claim
- [x] **PB-003:** Document project-inventory refresh choice + failure rules
- [x] **PB-004:** ASM-007 decided = Both; SPEC 03 §5 synced (WEB-060…063)
- [x] **PB-005:** List SQL omission in §4; align SVC-020 wording
- [x] **PB-006:** Clarify replica vs production; align §9 cutover wording
- [x] **PB-007:** TypeScript; admin auth; RBAC deferred; WEB-006 decided cache-only

### Remaining reviewer / PO actions (not spec defects)

- [x] Reviewer decided **ASM-001** (formula) — ⏳ PO ratification advisable
- [ ] PO confirms or amends **ASM-002** (color thresholds)
- [ ] PO confirms or amends **ASM-003** (project item status)
- [x] Reviewer decided **ASM-007** (Inventory Status = Both)
- [x] Reviewer decided **WEB-006** (cache-only reload)
- [ ] Reviewer approves suite for replica Stages 1–3

---

## 6. What is out of scope for this review file

- Implementing code or changing approved Must IDs without reviewer action
- Approving DEC-001 (cost tier) or DEC-002 (Azure auth)
- Production Salesforce SSO wiring or real `dev.myx.ac` credential handling beyond Key Vault guidance already in the suite

---

## 7. Traceability (pushback → spec IDs)

| Pushback | Spec IDs / sections primarily affected |
|---|---|
| PB-001 | ASM-001, ASM-002, ASM-003, SVC-002, SVC-003, WEB-024, WEB-046, WEB-047, TEST-010…013, TEST-016 |
| PB-002 | SVC-043, MOCK-060, ASM-005, SVC-042, WEB-040, Spec 00 §9 |
| PB-003 | SVC-001, SVC-001a, SVC-042, SVC-042a, TEST-017 |
| PB-004 | ASM-007, WEB-060…063, SVC-032 |
| PB-005 | SVC-020, Spec 00 §4, AZ-020/021 |
| PB-006 | Spec 00 §1/§3/§4/§9, WEB-008, AZ-030/031 |
| PB-007 | Spec 03 language, SVC-045, AZ-011a, WEB-006, WEB-009, TEST-018 |

---

## 8. Change log for this review doc

| Date | Change |
|---|---|
| 2026-07-21 | Initial accuracy reading and pushbacks recorded under `docs/spec/` |
| 2026-07-21 | Banner note: v1.1 addressed all seven PBs in suite text |
| 2026-07-21 | **v1.1.1:** Refresh §1–2 verdict/scorecard to current state; check off closed checklist items; split remaining PO actions; record minor suite cleanups (00 §9, SVC-020) |
| 2026-07-21 | **v1.2:** Synced to `decisions-log.md` (ASM-001/007/WEB-006 decided); checklist + scorecard updated; only ASM-002/003 remain OPEN |
