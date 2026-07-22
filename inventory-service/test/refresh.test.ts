/**
 * refresh.test.ts — TEST-015 retry + keep-last-good.
 * Uses a stubbed BcClient and an injected sleep (faked backoff) so no network
 * and no real timers are needed while still asserting the 1s/2s/4s schedule.
 */
import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_CONFIG } from '@inventory/shared';
import type {
  BcInventoryRow,
  BcPurchaseOrderRow,
  BcDemandRow,
  Snapshot,
} from '@inventory/shared';
import { MemoryStore } from '../src/cache/memory';
import { Health } from '../src/health';
import { runCycle } from '../src/refresh';
import type { RefreshDeps } from '../src/refresh';
import type { BcClient } from '../src/bcClient';
import type { AlertSink } from '../src/alerts';

const invRow: BcInventoryRow = {
  no: 'IN-100103',
  description: 'Alpine Telluride',
  i360Id: 'x',
  sqftPerCase: 23.8,
  linearFtPerUnit: 0,
  itemCategoryCode: 'FLOORING',
  locationCode: 'CHA',
  locationName: 'Charlotte',
  qoh: 100,
};
const poRow: BcPurchaseOrderRow = {
  no: 'IN-100103',
  description: 'Alpine Telluride',
  i360Id: 'x',
  sqftPerCase: 23.8,
  linearFtPerUnit: 0,
  itemCategoryCode: 'FLOORING',
  locationCode: 'CHA',
  locationName: 'Charlotte',
  qpo: 40,
  sfdcSoNo: '',
  purchNo: 'PO-000001',
  expected_Receipt_Date: '2026-08-10',
};
const demRow: BcDemandRow = {
  no: 'IN-100103',
  description: 'Alpine Telluride',
  qoh: 100,
  onPO: 40,
  demand: 50,
  netInventory: 90,
  locationName: 'Charlotte',
  locationCode: 'CHA',
  itemKey: 'IN-100103-CHA',
  projectName: 'P',
};

function stubClient(overrides: Partial<BcClient> = {}): BcClient {
  return {
    getInventory: async () => [invRow],
    getPurchaseOrders: async () => [poRow],
    getDemand: async () => [demRow],
    getInventoryByProject: async () => ({ projectNo: 'PRJ1', items: [] }),
    getProjects: async () => [],
    ...overrides,
  };
}

function makeDeps(client: BcClient, delays: number[]): {
  deps: RefreshDeps;
  health: Health;
  alerts: { fail: ReturnType<typeof vi.fn>; recover: ReturnType<typeof vi.fn> };
} {
  const health = new Health();
  const alerts: AlertSink & {
    fail: ReturnType<typeof vi.fn>;
    recover: ReturnType<typeof vi.fn>;
  } = {
    fail: vi.fn(),
    recover: vi.fn(),
  };
  const deps: RefreshDeps = {
    client,
    health,
    alerts,
    sleep: async (ms: number) => {
      delays.push(ms);
    },
  };
  return { deps, health, alerts };
}

const seededSnapshot: Snapshot = {
  refreshedAt: '2026-07-20T12:00:00.000Z',
  lastAttemptAt: '2026-07-20T12:00:00.000Z',
  healthy: true,
  consecutiveFailures: 0,
  sources: {
    inventory: { status: 'ok', rowCount: 1 },
    purchaseOrders: { status: 'ok', rowCount: 1 },
    demand: { status: 'ok', rowCount: 1 },
  },
  items: [],
};

describe('TEST-015 retry then keep-last-good', () => {
  it('015.1 fails twice then succeeds: 3 attempts, 1s/2s backoff, snapshot updated', async () => {
    let calls = 0;
    const client = stubClient({
      getInventory: async () => {
        calls++;
        if (calls < 3) throw new Error('transient');
        return [invRow];
      },
    });
    const delays: number[] = [];
    const { deps, health } = makeDeps(client, delays);
    const store = new MemoryStore();

    const result = await runCycle(store, DEFAULT_CONFIG, deps);

    expect(result.ok).toBe(true);
    expect(calls).toBe(3); // SVC-012: up to 3 attempts
    expect(delays).toEqual([1000, 2000]); // exponential backoff between attempts
    const snap = store.get()!;
    expect(snap).not.toBeNull();
    expect(snap.items).toHaveLength(1);
    expect(health.getConsecutiveFailures()).toBe(0);
    expect(health.isHealthy()).toBe(true);
  });

  it('015.2 fails all attempts: cycle failed, previous snapshot retained unchanged', async () => {
    const client = stubClient({
      getInventory: async () => {
        throw new Error('down');
      },
    });
    const delays: number[] = [];
    const { deps, health, alerts } = makeDeps(client, delays);
    const store = new MemoryStore();
    store.set(seededSnapshot);

    const result = await runCycle(store, DEFAULT_CONFIG, deps);

    expect(result.ok).toBe(false);
    // SVC-014: last-good retained unchanged, including original refreshedAt.
    const snap = store.get()!;
    expect(snap).toBe(seededSnapshot);
    expect(snap.refreshedAt).toBe('2026-07-20T12:00:00.000Z');
    expect(delays).toEqual([1000, 2000]); // 2 sleeps between the 3 failed attempts
    expect(health.getConsecutiveFailures()).toBe(1);
    expect(alerts.fail).toHaveBeenCalledTimes(1);
    expect(alerts.fail.mock.calls[0][0].consecutiveFailures).toBe(1);
  });

  it('015.3 one of three feeds fails: whole cycle failed, no partial snapshot', async () => {
    const client = stubClient({
      getDemand: async () => {
        throw new Error('demand down');
      },
    });
    const delays: number[] = [];
    const { deps } = makeDeps(client, delays);
    const store = new MemoryStore();

    const result = await runCycle(store, DEFAULT_CONFIG, deps);

    expect(result.ok).toBe(false);
    expect(store.get()).toBeNull(); // nothing published
  });

  it('consecutiveFailures increments then recovery alert fires on next success', async () => {
    let up = false;
    const client = stubClient({
      getInventory: async () => {
        if (!up) throw new Error('down');
        return [invRow];
      },
    });
    const delays: number[] = [];
    const { deps, health, alerts } = makeDeps(client, delays);
    const store = new MemoryStore();

    await runCycle(store, DEFAULT_CONFIG, deps); // fail
    expect(health.getConsecutiveFailures()).toBe(1);
    expect(alerts.recover).not.toHaveBeenCalled();

    up = true;
    await runCycle(store, DEFAULT_CONFIG, deps); // recover
    expect(health.getConsecutiveFailures()).toBe(0);
    expect(alerts.recover).toHaveBeenCalledTimes(1);
  });
});
