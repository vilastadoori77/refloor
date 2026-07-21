# React Inventory Website — Consolidated Requirements & Gap Analysis

> Consolidated from `React Inventory Website Requirements.docx` and
> `API_React Inventory Website Requirements.docx` (Michael Agrusso, 7/14/2026),
> plus analysis of the three embedded screenshots (Power BI Satellite screen,
> Power BI Project screen, brand color palette).
>
> The **API_ version is the authoritative document** — it is identical to the base
> version but fills in the endpoint URLs and sample responses.

---

## 1. Project Overview

| Field | Value |
|---|---|
| Target Release | 1.0 |
| Epic | Inventory Availability Flash |
| Module/Product | Web Application |
| Product Owner | Michael Agrusso |
| Developer | Jaffer-MW / GLD-UX |
| QA | Matthew Elias |
| Business Owner | Jay Wolgin |

**Goal:** Replace the existing Power BI Inventory Dashboard with a near-real-time
React web application backed by an Inventory Service, so Project Coordinators,
Regional Managers, and Operations can:

- See inventory availability, demand, and incoming purchase orders across all
  satellites and warehouses in one place.
- Confirm a project has all required materials **before** scheduling or
  dispatching an installation.
- Catch shortages early enough to purchase, transfer, or reschedule before the
  customer is impacted.

---

## 2. Architecture

Two components:

### 2.1 Inventory Service (backend)

Retrieves, consolidates, caches, and exposes inventory data.

Responsibilities:
- Retrieve inventory, purchase orders, project inventory, and demand from the
  Azure Middleware APIs (Business Central behind them).
- Consolidate the data and **calculate inventory availability**.
- Store results in a cache (Redis preferred; SQL Server alternative).
- Refresh the cache on a configurable interval (default **5 minutes**,
  changeable **without deployment**).
- Retain the last successful cache when a refresh fails; retry on failure.
- Log refresh success/failure; send email alerts; expose dashboard status.
- Expose internal APIs consumed only by the React website.

### 2.2 Inventory Website (React frontend)

Responsibilities:
- Display inventory by satellite and by project.
- Search and filter inventory.
- Display project readiness and inventory status.
- Display the last refresh timestamp ("Last Updated").

---

## 3. Source APIs (Azure Middleware, `dev.myx.ac`)

> ⚠️ **Security:** the source document embeds a `refloor_auth` credential
> (base64 `username:token`) directly in every URL. That credential must be
> **rotated**, stored in **Azure Key Vault**, and scrubbed from the circulating
> document. It is intentionally not reproduced here.

### 3.1 `GET /BC/GetInventory`
Returns inventory by warehouse/satellite. Large dataset.

```json
{
  "no": "IN-100103",
  "description": "Alpine Telluride",
  "i360Id": "a28PZ000009ii1mYAA",
  "sqftPerCase": 23.8,
  "linearFtPerUnit": 0,
  "itemCategoryCode": "FLOORING",
  "locationCode": "CHA",
  "locationName": "Charlotte",
  "qoh": 2
}
```

### 3.2 `GET /BC/GetPurchaseOrders`
Returns open purchase orders. Same item fields plus:

```json
{
  "qpo": 0,
  "sfdcSoNo": "",
  "purchNo": "PO-012976",
  "expected_Receipt_Date": "2026-07-23"
}
```

### 3.3 `GET /BC/Demand?instance=sandbox`
Returns current demand rows:

```json
{
  "no": "IN-100103",
  "description": "Alpine Telluride",
  "qoh": 0,
  "onPO": 0,
  "demand": 6,
  "netInventory": -6,
  "locationName": "Chicago",
  "locationCode": null,
  "itemKey": "IN-100103",
  "projectName": "Vinyl Flooring : Elias, Matthew"
}
```

### 3.4 `GET /BC/GetInventoryByProject/{PRJxxxx}?instance=sandbox`
Returns inventory requirements for one project:

```json
{
  "projectNo": "PRJ51508",
  "items": [
    {
      "no": "IN-100410",
      "description": "Artisan Plank Finnish Pine",
      "qoh": 14,
      "onPO": 0,
      "demand": 19,
      "netInventory": -5,
      "locationName": "Grand Rapids",
      "locationCode": "DET",
      "itemKey": "IN-100410-DET",
      "projectName": "Vinyl Flooring : Ball, Sandi"
    }
  ]
}
```

---

## 4. Functional Requirements (Must Have)

### Cache Refresh
- Configurable interval (default 5 min, no redeploy needed).
- Refresh logging.
- Retry logic.
- Last successful cache retained on failure.

### Cache Storage
- Redis (preferred) or SQL Server.
- Atomic updates (readers never see a half-written refresh).
- Cached timestamp stored and exposed.

### API Health
- Failure logging.
- Email alerts.
- Dashboard status.

---

## 5. Technical Requirements

| Area | Requirement |
|---|---|
| Authentication | Salesforce SSO — same model as `cxsales.refloor.com` |
| Hosting | Azure App Service at `inventory.refloor.com`, SSL |
| Secrets | Azure Key Vault |
| Monitoring | Application Insights |
| Cache | Redis preferred, SQL Server alternative |
| Refresh | Default every 5 minutes, configurable without deployment |

---

## 6. UI Requirements (from spec + screenshot analysis)

The UI shall closely match the existing Power BI Inventory Dashboard and follow
the brand palette.

### 6.1 Brand palette (from marketing standards screenshot)

| Role | Color | Hex |
|---|---|---|
| Main — dark navy (theme/background) | Navy | `#262262` |
| Main — white (text) | White | `#FFFFFF` |
| Main — gold (accents/warnings) | Gold | `#D29B3C` |
| Supporting — sky blue (interactive/selected) | Blue | `#30AEE4` |
| Supporting — brown | Brown | `#5B381F` |

### 6.2 Navigation
Sidebar menu: **Satellites**, **Projects**, **Inventory Status** (spec).
Screenshot also shows an **Item Details** entry — see Gaps §7.

### 6.3 Satellite screen (screenshot 1)
- Header: "Inventory Dashboard" + "Analytics & Project Search", refresh icon,
  and last-refresh date/time (top-right).
- Left sidebar: Menu + **Inventory Filters** — Satellite dropdown (e.g.
  "Detroit"), Item Category filter, Item filter, "Clear filters" action.
- Main grid: "All Inventory Items", grouped by Item Category (e.g. FLOORING),
  columns: **On Hand, Allocated, Available, Available (ft²), Ordered**.
- Conditional formatting on the Available columns: green = healthy,
  yellow/orange = low, red = negative/shortage.

### 6.4 Project screen (screenshot 2)
- Left sidebar: **Sale Selection** panel — Sale #, Satellite, Customer,
  BC Status, File Status, Install Date.
- Left sidebar: **Inventory Status** panel — status dots for "Flooring
  Materials" and "Additional Materials" (green = ready, yellow = attention),
  plus a gold warning callout, e.g. "Additional materials are not available.
  Verify delivery before proceeding."
- Main area: two tables:
  - **Flooring** — with caption: "Unless approved by a Project Coordination
    Manager, please do not schedule this project if a green check box is not
    present on all listed flooring items."
  - **Additional Materials** (moldings, transitions, adhesives/sealants,
    other) — with caption: "Please ensure missing materials will be delivered
    prior to the Installation Completion Date so as not to impact the
    installation time frame."
- Both tables: columns **Required, Available, Ordered, Picked, Remainder,
  Item Status** (green check / warning icon), with Totals rows.

### 6.5 Theme
- Match the current dark theme (navy `#262262` base).
- Preserve the familiar workflow from Power BI.
- Responsive design.
- Display "Last Updated" timestamp.

---

## 7. Gaps & Open Questions (confirm with Product Owner)

1. **Availability formula not defined.** The grid shows On Hand, Allocated,
   Available, Available (ft²), Ordered. The API supplies `qoh`, `qpo`/`onPO`,
   `demand`, `netInventory`. Proposed mapping (needs confirmation):
   - On Hand = `qoh`
   - Allocated = `demand` (sum of project demand at that location)
   - Available = `qoh − demand` (matches `netInventory` when `onPO = 0`?)
   - Available (ft²) = Available × `sqftPerCase`
   - Ordered = `qpo` (open PO quantity)
2. **Color thresholds not defined.** What Available values map to
   green / yellow / red? (e.g. red < 0, yellow 0–N, green > N?)
3. **"Item Details" screen** appears in the screenshot menu but not in the
   written navigation requirements. In or out of scope for 1.0?
4. **"Inventory Status" navigation item** is listed in the spec but has no
   screenshot or display requirements. What does it show?
5. **Endpoint inconsistencies:** `GetDemand` in prose vs `/BC/Demand` in URL;
   `?instance=sandbox` present on some endpoints only. Confirm production
   endpoint names and whether `instance` is required.
6. **Data quality:** `Demand` rows can have `locationCode: null`;
   `GetInventoryByProject` shows mismatched name/code ("Grand Rapids"/"DET").
   Consolidation must define the canonical location key and handle nulls.
7. **Project search:** how do users find a project/sale — by Sale #, PRJ number,
   customer name? What service provides the sale header data (Sale #, Customer,
   BC Status, File Status, Install Date) shown in the Sale Selection panel?
   None of the four listed APIs return it.
8. **"Picked" column** on the Project screen has no source field in any listed
   API. Where does picked quantity come from?
9. **Authorization scope:** does Salesforce SSO imply role-based differences
   (Coordinator vs Regional Manager vs Ops), or does everyone see everything?
10. **Security:** embedded `refloor_auth` token in the docx must be rotated and
    moved to Key Vault; the doc should be scrubbed.
11. **Refresh UX:** manual refresh button (screenshot shows a refresh icon) —
    does it trigger a service re-pull or just re-read the cache?
12. **Volume/retention:** "large dataset" is unquantified — need row counts to
    size cache, pagination, and grid virtualization.
