# SPEC 01 — Mock BC API

Stands in for **Azure Middleware APIs + Business Central** (architecture layers 6–7).
Node 18+ / Express / port **4000**. No database — dataset generated in memory at startup.

Priorities: **M** = Must, **S** = Should, **C** = Could.

---

## 1. General behavior

| ID | Pri | Requirement |
|---|---|---|
| MOCK-001 | M | Expose HTTP server on port `4000` (env `MOCK_PORT` overrides). |
| MOCK-002 | M | All `/BC/*` responses are JSON with shapes **identical** to the samples in `API_React Inventory Website Requirements.docx` — same field names, same casing (incl. `expected_Receipt_Date`), same types. |
| MOCK-003 | M | Route paths match the real middleware paths: `/BC/GetInventory`, `/BC/GetPurchaseOrders`, `/BC/Demand`, `/BC/GetInventoryByProject/:projectNo`. Any `refloor_auth=…` path segment or `instance` query param is **accepted and ignored** (mimics real URL format without validating the credential). |
| MOCK-004 | M | Dataset is generated **deterministically** from a fixed seed (env `MOCK_SEED`, default `42`) — same data every restart, so UI reviews and tests are reproducible. |
| MOCK-005 | M | No real credential from the source documents may appear anywhere in this repo. |
| MOCK-006 | S | Every request logged to console: method, path, status, duration ms. |
| MOCK-007 | C | Optional response latency simulation via env `MOCK_LATENCY_MS` (default 0). |

## 2. Endpoint contracts

### MOCK-010 (M) — `GET /BC/GetInventory`
Array of inventory rows, one per item × stocking location:

```json
{
  "no": "IN-100103",            // string, item key "IN-1xxxxx"
  "description": "Alpine Telluride",
  "i360Id": "a28PZ000009ii1mYAA",
  "sqftPerCase": 23.8,           // number; 0 for non-flooring
  "linearFtPerUnit": 0,          // number; >0 for moldings/transitions
  "itemCategoryCode": "FLOORING",
  "locationCode": "CHA",
  "locationName": "Charlotte",
  "qoh": 2                       // number ≥ 0
}
```

### MOCK-011 (M) — `GET /BC/GetPurchaseOrders`
Array of open-PO rows: all MOCK-010 fields (minus `qoh`) **plus**
`qpo` (number), `sfdcSoNo` (string, may be `""`), `purchNo` ("PO-0xxxxx"),
`expected_Receipt_Date` ("YYYY-MM-DD").

### MOCK-012 (M) — `GET /BC/Demand`
Array of demand rows:
`no, description, qoh, onPO, demand, netInventory, locationName, locationCode, itemKey, projectName`.
`netInventory` **must** equal `qoh + onPO − demand`. `projectName` format:
`"Vinyl Flooring : {Last}, {First}"`.

### MOCK-013 (M) — `GET /BC/GetInventoryByProject/:projectNo`
`{ "projectNo": "PRJxxxxx", "items": [ …demand-row shape, itemKey = "IN-xxxxxx-<LOC>" ] }`.
Unknown `projectNo` → `404 { "error": "project not found" }`.

## 3. Generated dataset

| ID | Pri | Requirement |
|---|---|---|
| MOCK-040 | M | **Locations:** the 8 satellites of ASM-008, code ↔ name 1:1. |
| MOCK-041 | M | **Flooring catalog:** ≥ 24 items, `itemCategoryCode: "FLOORING"`, names taken from screenshot 1 (Coretec Pro Plus lines, Captivate, Iconic, Paragon Tile Plus, etc.), `sqftPerCase` 18–28. |
| MOCK-042 | M | **Additional-materials catalog:** ≥ 8 items across `MOLDING`, `TRANSITIONS`, `ADHESIVES / SEALANTS`, `OTHER`, names from screenshot 2 (1/4" Round Molding-Vinyl White, Metal T Track, Schonox SL, Schonox SHP Primer, etc.), `linearFtPerUnit` > 0 where sensible. |
| MOCK-043 | M | **Inventory rows:** each item stocked in 3–8 locations, `qoh` 0–250. |
| MOCK-044 | M | **Projects:** ≥ 12 projects `PRJ5xxxx`, each tied to one satellite: 1–2 flooring items + 3–6 additional materials with `demand` quantities. Demand endpoint (MOCK-012) is the flattened union of all project items — the two views must be mutually consistent. |
| MOCK-045 | M | **Edge cases guaranteed present:** (a) ≥ 3 item+location rows with negative `netInventory`; (b) ≥ 2 demand rows with `locationCode: null`; (c) ≥ 1 location-name/code mismatch row (mimics "Grand Rapids"/"DET"); (d) ≥ 1 project fully ready (all green); (e) ≥ 1 project with flooring ready but additional materials short (drives the gold warning callout); (f) ≥ 1 item with `qoh 0`, `demand > 0`, open PO covering the shortage. |
| MOCK-046 | M | **POs:** ~25% of item+locations have an open PO, `qpo` 20–100, `expected_Receipt_Date` 1–30 days after server start date. |

## 4. Mock-only extensions (clearly non-canonical)

| ID | Pri | Requirement |
|---|---|---|
| MOCK-060 | M | `GET /BC/_mock/GetProjects` — sale headers for all projects: `{ projectNo, saleNo ("S00xxx"), customer ("Last, First"), satelliteCode, satelliteName, bcStatus ("Open"\|"Released"), fileStatus ("Step 2"\|"Step 3"…), installDate ("M/D/YY (Day)") }`. Path prefixed `_mock/` because no real equivalent exists (ASM-005). |
| MOCK-061 | S | Response header `X-Mock-Api: true` on every response, as a permanent reminder this is not the real middleware. |

## 5. Failure simulation (outage switch)

| ID | Pri | Requirement |
|---|---|---|
| MOCK-070 | M | `POST /admin/outage {"enabled": true\|false, "endpoints": ["inventory","purchaseOrders","demand","project"]?}` — while enabled, targeted `/BC/*` endpoints return `500 { "error": "simulated outage" }`. Omitted `endpoints` = all. |
| MOCK-071 | M | `GET /admin/outage` returns current outage state. |
| MOCK-072 | S | `POST /admin/reseed {"seed": n}` regenerates the dataset without restart (for demo variety). |

## 6. Acceptance criteria (Stage 1 checkpoint)

- [ ] All four `/BC/*` endpoints return shapes that validate against the docx samples field-for-field.
- [ ] Same seed → byte-identical dataset across restarts.
- [ ] All six MOCK-045 edge cases demonstrably present (test queries provided).
- [ ] Outage switch flips endpoints between 200 and 500 live.
- [ ] Demand rows reconcile exactly with per-project items (MOCK-044 consistency).
