# Decisions Log

**Project:** Inventory Availability Flash — Local Replica & Azure Port
**Purpose:** Durable record of decisions taken on OPEN / deferred items in the
spec suite. Referenced by [`00-overview.md`](00-overview.md) §5. Per the
deviation rule (SPEC 05 §6), decisions are recorded here, not silently in code.

**Legend:** `By` — who made the call. **reviewer** = the person approving this
spec suite (the replica owner). **PO** = Product Owner (Michael Agrusso / Jay
Wolgin). A reviewer decision unblocks the build; **PO ratification** is still
advisable before any number is represented as production-accurate
(reviewer ≠ Product Owner unless confirmed).

---

## 1. Decisions taken

| Date | ID | Decision | By | Status |
|---|---|---|---|---|
| 2026-07-21 | ASM-001 | **Availability formula = `Available = OnHand − Allocated`** (OnHand = `qoh`; Allocated = Σ`demand` for item+location; Ordered = Σ`qpo`). Available (ft²) = Available × `sqftPerCase`. | reviewer | ✅ Decided · ⏳ PO ratification advisable |
| 2026-07-21 | ASM-007 | **"Inventory Status" nav = Both.** Main screen is an **operational shortage board** (items/projects below threshold across all satellites, on `/api/inventory` data); the **service health / refresh status** is relocated to a smaller widget. Supersedes the earlier health-page-only working assumption. | reviewer | ✅ Decided |
| 2026-07-21 | WEB-006 | **Manual refresh = cache-only reload.** The UI refresh control re-reads the current snapshot; it does **not** force the service to re-pull the middleware feeds. | reviewer | ✅ Decided |

### Rationale / notes

- **ASM-001 — ⚠️ known divergence.** The selected default **ignores
  Ordered/`onPO`**, whereas the source API's own `netInventory = qoh + onPO −
  demand` includes it. The satellite grid may therefore diverge from the real
  Power BI numbers. Accepted for the replica because the consolidator exposes the
  formula as a **named strategy** (SVC-002/003), so switching to
  `qoh + onPO − demand` is a config change, not a rewrite. PO ratification
  advisable before the numbers are trusted as production-accurate.
- **ASM-007 — build impact.** Confirms WEB-060…063: build both the shortage
  board (primary) and the health widget (secondary). Neither is a throwaway.
- **WEB-006 — build impact.** No admin re-pull is wired to the UI control. The
  admin force-refresh path (`POST /api/admin/refresh`, SVC-045) remains a
  separate, auth-guarded operation, not the user-facing refresh button.

---

## 2. Still OPEN — needs Product Owner

These remain 🔶 OPEN in SPEC 00 §5. They ship as **configurable defaults**
(values in config, changeable at runtime per SVC-003 / SVC-011) and are **not**
locked truth until the PO confirms.

| ID | Open question | Current default (placeholder) |
|---|---|---|
| ASM-002 | Color thresholds for the satellite grid | red if Available < 0; yellow if 0 ≤ Available < 25% of Allocated (min 10 units when Allocated = 0); green otherwise |
| ASM-003 | Project item status logic | Ready if Available ≥ Required; Attention if Available < Required but Available + Ordered ≥ Required; Short otherwise. Remainder = Required − Picked |

**Guardrail (PB-001):** these must never be hard-coded as branch logic — they
read from the config object, enforced by TEST-011/013/016.

---

## 3. Deferred to Stage 5 (do not block build)

Per SPEC 00 §6. Recorded here so the deferral is explicit, not forgotten.

| ID | Decision | Options | Status |
|---|---|---|---|
| DEC-001 | Azure cost tier | (a) Free: F1 App Services + in-memory cache, $0/mo · (b) Paid: B1 + Azure Cache for Redis Basic C0, ~$16–30/mo | ⏳ Deferred to Stage 5 |
| DEC-002 | Azure auth | (a) Dev-stub login · (b) Microsoft Entra ID (free tier) | ⏳ Deferred to Stage 5 |

---

## 4. Change log for this file

| Date | Change |
|---|---|
| 2026-07-21 | Created to back the `decisions-log.md` reference in SPEC 00 §5; recorded the three 2026-07-21 reviewer decisions (ASM-001, ASM-007, WEB-006), the still-OPEN ASM-002/003 defaults, and the DEC-001/002 Stage-5 deferrals. |
| 2026-07-21 | Suite **v1.2:** SPEC 02/03/06 + CHANGELOG synced to this log (WEB-060…063 defined; stale OPEN labels removed where decided). |
