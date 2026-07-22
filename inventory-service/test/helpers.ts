/**
 * helpers.ts — spin up the Express app on an ephemeral port and talk to it over
 * real HTTP with global fetch (no supertest dependency).
 */
import type { AddressInfo } from 'node:net';
import type { Snapshot } from '@inventory/shared';
import { DEFAULT_CONFIG } from '@inventory/shared';
import { createApp } from '../src/api';
import type { ApiDeps } from '../src/api';
import { MemoryStore } from '../src/cache/memory';
import { Health } from '../src/health';
import type { BcClient } from '../src/bcClient';

export function stubClient(overrides: Partial<BcClient> = {}): BcClient {
  return {
    getInventory: async () => [],
    getPurchaseOrders: async () => [],
    getDemand: async () => [],
    getInventoryByProject: async () => ({ projectNo: '', items: [] }),
    getProjects: async () => [],
    ...overrides,
  };
}

export function makeApiDeps(overrides: Partial<ApiDeps> = {}): ApiDeps {
  return {
    store: new MemoryStore(),
    getConfig: () => DEFAULT_CONFIG,
    updateConfig: (p) => ({ ...DEFAULT_CONFIG, ...p }),
    health: new Health(),
    client: stubClient(),
    triggerRefresh: async () => ({ ok: true }),
    ...overrides,
  };
}

export interface RunningApp {
  base: string;
  close: () => Promise<void>;
}

export async function startApp(deps: ApiDeps): Promise<RunningApp> {
  const app = createApp(deps);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export function seededSnapshot(items: Snapshot['items']): Snapshot {
  return {
    refreshedAt: '2026-07-21T00:00:00.000Z',
    lastAttemptAt: '2026-07-21T00:00:00.000Z',
    healthy: true,
    consecutiveFailures: 0,
    sources: {
      inventory: { status: 'ok', rowCount: items.length },
      purchaseOrders: { status: 'ok', rowCount: items.length },
      demand: { status: 'ok', rowCount: items.length },
    },
    items,
  };
}
