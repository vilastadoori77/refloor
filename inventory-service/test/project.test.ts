/**
 * project.test.ts — TEST-017 live project-fetch failure → 503, not stale,
 * while /api/inventory keeps serving the current snapshot.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { ConsolidatedItem } from '@inventory/shared';
import { MemoryStore } from '../src/cache/memory';
import { makeApiDeps, startApp, stubClient, seededSnapshot } from './helpers';
import type { RunningApp } from './helpers';

const item: ConsolidatedItem = {
  itemNo: 'IN-100103',
  description: 'Alpine Telluride',
  i360Id: 'x',
  itemCategoryCode: 'FLOORING',
  sqftPerCase: 23.8,
  linearFtPerUnit: 0,
  locationCode: 'CHA',
  locationName: 'Charlotte',
  onHand: 100,
  allocated: 50,
  ordered: 40,
  available: 50,
  availableSqft: 1190,
  status: 'green',
};

let running: RunningApp | null = null;
afterEach(async () => {
  if (running) await running.close();
  running = null;
});

describe('TEST-017 project-fetch failure → 503, inventory still served', () => {
  it('returns 503 { error } and serves no stale project data', async () => {
    const store = new MemoryStore();
    store.set(seededSnapshot([item]));
    const client = stubClient({
      getInventoryByProject: async () => {
        throw new Error('project source down');
      },
    });
    running = await startApp(makeApiDeps({ store, client }));

    // Project endpoint and inventory hit concurrently.
    const [projRes, invRes] = await Promise.all([
      fetch(`${running.base}/api/projects/PRJ50001`),
      fetch(`${running.base}/api/inventory`),
    ]);

    expect(projRes.status).toBe(503);
    const projBody = (await projRes.json()) as { error: string };
    expect(projBody.error).toBe('project source unavailable');
    expect(projBody).not.toHaveProperty('flooring'); // no stale project payload

    // Satellite view unaffected.
    expect(invRes.status).toBe(200);
    const invBody = (await invRes.json()) as {
      refreshedAt: string;
      data: ConsolidatedItem[];
    };
    expect(invBody.refreshedAt).toBe('2026-07-21T00:00:00.000Z');
    expect(invBody.data).toHaveLength(1);
    expect(invBody.data[0].itemNo).toBe('IN-100103');
  });

  it('builds a project view joining live required against snapshot available', async () => {
    const store = new MemoryStore();
    store.set(seededSnapshot([item]));
    const client = stubClient({
      getInventoryByProject: async () => ({
        projectNo: 'PRJ50001',
        items: [
          {
            no: 'IN-100103',
            description: 'Alpine Telluride',
            qoh: 0,
            onPO: 0,
            demand: 30,
            netInventory: -30,
            locationName: 'Charlotte',
            locationCode: 'CHA',
            itemKey: 'IN-100103-CHA',
            projectName: 'P',
            itemCategoryCode: 'FLOORING',
            sqftPerCase: 23.8,
            linearFtPerUnit: 0,
            required: 30,
          },
        ],
      }),
      getProjects: async () => [
        {
          projectNo: 'PRJ50001',
          saleNo: 'S00123',
          customer: 'Doe, Jane',
          satelliteCode: 'CHA',
          satelliteName: 'Charlotte',
          bcStatus: 'Open',
          fileStatus: 'Step 2',
          installDate: '8/1/26 (Fri)',
        },
      ],
    });
    running = await startApp(makeApiDeps({ store, client }));

    const res = await fetch(`${running.base}/api/projects/PRJ50001`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        header: { satelliteCode: string } | null;
        flooring: Array<{ required: number; available: number; itemStatus: string }>;
        additional: unknown[];
        status: { flooringReady: boolean };
      };
    };
    expect(body.data.header?.satelliteCode).toBe('CHA');
    expect(body.data.flooring).toHaveLength(1);
    // required 30 vs snapshot available 50 → ready.
    expect(body.data.flooring[0].required).toBe(30);
    expect(body.data.flooring[0].available).toBe(50);
    expect(body.data.flooring[0].itemStatus).toBe('ready');
    expect(body.data.status.flooringReady).toBe(true);
  });
});
