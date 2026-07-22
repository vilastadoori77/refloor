/**
 * Contract tests (TEST-020 … TEST-024 + sub-cases).
 *
 * Data invariants are checked against `makeDataset('42')` directly; HTTP
 * behaviors (routes, casing, outage, headers, 404, auth-ignore) are checked by
 * booting the exported `app` on an ephemeral port and calling it over fetch.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  BcInventoryRow,
  BcPurchaseOrderRow,
  BcDemandRow,
  BcProjectResponse,
  SaleHeader,
} from '@inventory/shared';
import { app } from '../src/index';
import { makeDataset } from '../src/dataset';

let server: Server;
let base: string;

async function get(path: string): Promise<Response> {
  return fetch(`${base}${path}`);
}
async function getJson<T>(path: string): Promise<T> {
  const res = await get(path);
  return (await res.json()) as T;
}

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ── TEST-020: shape & casing of the four /BC/* endpoints ──────────────────────
describe('TEST-020 — JSON shapes of all four /BC/* responses', () => {
  it('020.1 GetInventory rows have the MOCK-010 fields and qoh ≥ 0', async () => {
    const rows = await getJson<BcInventoryRow[]>('/BC/GetInventory');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(
        [
          'description', 'i360Id', 'itemCategoryCode', 'linearFtPerUnit',
          'locationCode', 'locationName', 'no', 'qoh', 'sqftPerCase',
        ].sort(),
      );
      expect(typeof r.no).toBe('string');
      expect(typeof r.description).toBe('string');
      expect(typeof r.i360Id).toBe('string');
      expect(typeof r.sqftPerCase).toBe('number');
      expect(typeof r.linearFtPerUnit).toBe('number');
      expect(typeof r.itemCategoryCode).toBe('string');
      expect(typeof r.locationName).toBe('string');
      expect(r.qoh).toBeGreaterThanOrEqual(0);
    }
  });

  it('020.2 GetPurchaseOrders adds qpo/sfdcSoNo/purchNo/expected_Receipt_Date (exact casing, YYYY-MM-DD)', async () => {
    const rows = await getJson<BcPurchaseOrderRow[]>('/BC/GetPurchaseOrders');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).not.toHaveProperty('qoh');
      expect(r).toHaveProperty('expected_Receipt_Date'); // exact casing
      expect(typeof r.qpo).toBe('number');
      expect(typeof r.sfdcSoNo).toBe('string');
      expect(r.purchNo).toMatch(/^PO-0\d{5}$/);
      expect(r.expected_Receipt_Date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('020.3 Demand rows have the MOCK-012 fields; projectName format matches', async () => {
    const rows = await getJson<BcDemandRow[]>('/BC/Demand');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(
        [
          'demand', 'description', 'itemKey', 'locationCode', 'locationName',
          'netInventory', 'no', 'onPO', 'projectName', 'qoh',
        ].sort(),
      );
      expect(r.projectName).toMatch(/^Vinyl Flooring : .+, .+$/);
    }
  });

  it('020.4 GetInventoryByProject returns {projectNo, items[]} with IN-xxxxxx-<LOC> itemKeys', async () => {
    const headers = await getJson<SaleHeader[]>('/BC/_mock/GetProjects');
    const proj = await getJson<BcProjectResponse>(`/BC/GetInventoryByProject/${headers[0]!.projectNo}`);
    expect(proj.projectNo).toBe(headers[0]!.projectNo);
    expect(proj.items.length).toBeGreaterThan(0);
    for (const it of proj.items) {
      expect(it.itemKey).toMatch(/^IN-\d+-[A-Z]+$/);
      expect(typeof it.required).toBe('number');
      expect(typeof it.itemCategoryCode).toBe('string');
    }
  });

  it('020.5 unknown project → 404 {error:"project not found"}', async () => {
    const res = await get('/BC/GetInventoryByProject/PRJ99999');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'project not found' });
  });
});

// ── TEST-021: determinism ─────────────────────────────────────────────────────
describe('TEST-021 — determinism', () => {
  it('same seed → deep-equal dataset', () => {
    const a = makeDataset('42');
    const b = makeDataset('42');
    expect(a.inventory).toEqual(b.inventory);
    expect(a.purchaseOrders).toEqual(b.purchaseOrders);
    expect(a.demand).toEqual(b.demand);
    expect(a.saleHeaders).toEqual(b.saleHeaders);
    expect([...a.projects.entries()]).toEqual([...b.projects.entries()]);
  });

  it('PO dates use the fixed base date, never today', () => {
    const { purchaseOrders } = makeDataset('42');
    for (const po of purchaseOrders) {
      expect(po.expected_Receipt_Date >= '2026-01-02').toBe(true);
      expect(po.expected_Receipt_Date <= '2026-01-31').toBe(true);
    }
  });

  it('different seed → different dataset', () => {
    const a = makeDataset('42');
    const b = makeDataset('7');
    expect(a.demand).not.toEqual(b.demand);
  });
});

// ── TEST-022: demand ≡ flattened union of all project items ────────────────────
describe('TEST-022 — demand ≡ union of project items', () => {
  it('every demand row corresponds to a project item and vice-versa', () => {
    const { demand, projects } = makeDataset('42');
    const fromProjects: BcDemandRow[] = [];
    for (const proj of projects.values()) {
      for (const it of proj.items) {
        fromProjects.push({
          no: it.no,
          description: it.description,
          qoh: it.qoh,
          onPO: it.onPO,
          demand: it.demand,
          netInventory: it.netInventory,
          locationName: it.locationName,
          locationCode: it.locationCode,
          itemKey: it.itemKey,
          projectName: it.projectName,
        });
      }
    }
    expect(demand.length).toBe(fromProjects.length);
    const sortKey = (r: BcDemandRow): string => JSON.stringify(r);
    expect(demand.map(sortKey).sort()).toEqual(fromProjects.map(sortKey).sort());
  });
});

// ── TEST-024: netInventory identity ───────────────────────────────────────────
describe('TEST-024 — netInventory identity', () => {
  it('netInventory === qoh + onPO − demand for every demand row', () => {
    const { demand } = makeDataset('42');
    for (const r of demand) {
      expect(r.netInventory).toBe(r.qoh + r.onPO - r.demand);
    }
  });
});

// ── TEST-023: all six MOCK-045 edge cases ─────────────────────────────────────
describe('TEST-023 — MOCK-045 edge cases present', () => {
  const { demand, projects } = makeDataset('42');
  const isFlooring = (c: string): boolean => c === 'FLOORING';

  it('023.a ≥ 3 rows with negative netInventory', () => {
    expect(demand.filter((r) => r.netInventory < 0).length).toBeGreaterThanOrEqual(3);
  });

  it('023.b ≥ 2 demand rows with locationCode === null', () => {
    expect(demand.filter((r) => r.locationCode === null).length).toBeGreaterThanOrEqual(2);
  });

  it('023.c ≥ 1 name/code mismatch (Grand Rapids / DET)', () => {
    expect(
      demand.some((r) => r.locationName === 'Grand Rapids' && r.locationCode === 'DET'),
    ).toBe(true);
  });

  it('023.d ≥ 1 fully-ready project (all items qoh ≥ demand)', () => {
    const ready = [...projects.values()].some(
      (p) => p.items.length > 0 && p.items.every((it) => it.qoh >= it.demand),
    );
    expect(ready).toBe(true);
  });

  it('023.e ≥ 1 flooring-ready / additional-short project', () => {
    const found = [...projects.values()].some((p) => {
      const floor = p.items.filter((it) => isFlooring(it.itemCategoryCode));
      const add = p.items.filter((it) => !isFlooring(it.itemCategoryCode));
      const floorReady = floor.length > 0 && floor.every((it) => it.qoh >= it.demand);
      const addShort = add.some((it) => it.qoh + it.onPO < it.demand);
      return floorReady && addShort;
    });
    expect(found).toBe(true);
  });

  it('023.f ≥ 1 item with qoh 0, demand > 0, PO covering the shortage', () => {
    const found = demand.some((r) => r.qoh === 0 && r.demand > 0 && r.onPO >= r.demand);
    expect(found).toBe(true);
  });
});

// ── TEST-024.2: outage switch flips status codes live ─────────────────────────
describe('TEST-024.2 — outage switch', () => {
  afterAll(async () => {
    await fetch(`${base}/admin/outage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
  });

  it('targeted outage 200 ↔ 500 per endpoint', async () => {
    let res = await fetch(`${base}/admin/outage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true, endpoints: ['inventory'] }),
    });
    expect(res.status).toBe(200);

    res = await get('/BC/GetInventory');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'simulated outage' });

    res = await get('/BC/Demand');
    expect(res.status).toBe(200); // not targeted → still up

    const state = await getJson<{ enabled: boolean; endpoints: string[] }>('/admin/outage');
    expect(state.enabled).toBe(true);
    expect(state.endpoints).toContain('inventory');

    await fetch(`${base}/admin/outage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    res = await get('/BC/GetInventory');
    expect(res.status).toBe(200);
  });
});

// ── TEST-024.3: auth path segment accepted and ignored ────────────────────────
describe('TEST-024.3 — auth segment ignored', () => {
  it('same 200 payload with/without refloor_auth segment + instance query', async () => {
    const plain = await getJson<BcInventoryRow[]>('/BC/GetInventory');
    const authed = await getJson<BcInventoryRow[]>(
      '/refloor_auth=FAKE_IGNORED/BC/GetInventory?instance=sandbox',
    );
    expect(authed).toEqual(plain);
  });
});

// ── TEST-024.4: mock-only marker + X-Mock-Api header ──────────────────────────
describe('TEST-024.4 — mock-only marker', () => {
  it('_mock/GetProjects returns sale headers', async () => {
    const headers = await getJson<SaleHeader[]>('/BC/_mock/GetProjects');
    expect(headers.length).toBeGreaterThanOrEqual(12);
    for (const h of headers) {
      expect(Object.keys(h).sort()).toEqual(
        [
          'bcStatus', 'customer', 'fileStatus', 'installDate',
          'projectNo', 'saleNo', 'satelliteCode', 'satelliteName',
        ].sort(),
      );
      expect(h.saleNo).toMatch(/^S00\d{3}$/);
      expect(h.installDate).toMatch(/^\d{1,2}\/\d{1,2}\/\d{2} \([A-Za-z]{3}\)$/);
      expect(['Open', 'Released']).toContain(h.bcStatus);
    }
  });

  it('X-Mock-Api: true present on every response', async () => {
    const res = await get('/BC/GetInventory');
    expect(res.headers.get('x-mock-api')).toBe('true');
    const res2 = await get('/admin/outage');
    expect(res2.headers.get('x-mock-api')).toBe('true');
  });
});

// ── MOCK-072: reseed rebuilds the dataset ─────────────────────────────────────
describe('MOCK-072 — reseed', () => {
  afterAll(async () => {
    await fetch(`${base}/admin/reseed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seed: '42' }),
    });
  });

  it('POST /admin/reseed swaps to a new dataset without restart', async () => {
    const before = await getJson<BcDemandRow[]>('/BC/Demand');
    const res = await fetch(`${base}/admin/reseed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seed: '7' }),
    });
    expect(res.status).toBe(200);
    const after = await getJson<BcDemandRow[]>('/BC/Demand');
    expect(after).not.toEqual(before);
  });
});
