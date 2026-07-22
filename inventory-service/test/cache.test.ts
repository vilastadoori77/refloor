/**
 * cache.test.ts — TEST-014 atomic snapshot swap (readers never see partial).
 */
import { describe, it, expect } from 'vitest';
import type { ConsolidatedItem, Snapshot, SourceKey, SourceOutcome } from '@inventory/shared';
import { MemoryStore } from '../src/cache/memory';

function makeSnapshot(version: number, itemCount: number): Snapshot {
  const sources: Record<SourceKey, SourceOutcome> = {
    inventory: { status: 'ok', rowCount: itemCount },
    purchaseOrders: { status: 'ok', rowCount: itemCount },
    demand: { status: 'ok', rowCount: itemCount },
  };
  const items: ConsolidatedItem[] = Array.from({ length: itemCount }, (_, i) => ({
    itemNo: `IN-${version}-${i}`,
    description: `v${version}`, // marker used to detect a mixed read
    i360Id: 'x',
    itemCategoryCode: 'FLOORING',
    sqftPerCase: 1,
    linearFtPerUnit: 0,
    locationCode: 'CHA',
    locationName: 'Charlotte',
    onHand: version,
    allocated: 0,
    ordered: 0,
    available: version,
    availableSqft: version,
    status: 'green',
  }));
  return {
    refreshedAt: `2026-07-21T00:00:0${version}.000Z`,
    lastAttemptAt: `2026-07-21T00:00:0${version}.000Z`,
    healthy: true,
    consecutiveFailures: 0,
    sources,
    items,
  };
}

describe('TEST-014 atomic snapshot swap', () => {
  it('every read returns a complete A or complete B, never a mix', async () => {
    const store = new MemoryStore();
    const A = makeSnapshot(1, 500);
    const B = makeSnapshot(2, 500);
    store.set(A);

    let mixedReads = 0;
    let totalReads = 0;

    const readerInvariant = (): void => {
      const snap = store.get();
      if (!snap) return;
      totalReads++;
      // Derive the version from refreshedAt and require every item to match it.
      const marker = snap.items[0]?.description;
      const consistent =
        snap.items.every((it) => it.description === marker) &&
        snap.refreshedAt.endsWith(`0${marker === 'v1' ? 1 : 2}.000Z`);
      if (!consistent) mixedReads++;
    };

    const reader = async (): Promise<void> => {
      for (let i = 0; i < 2000; i++) {
        readerInvariant();
        if (i % 100 === 0) await Promise.resolve(); // yield
      }
    };

    const swapper = async (): Promise<void> => {
      for (let i = 0; i < 50; i++) {
        store.set(i % 2 === 0 ? B : A);
        await Promise.resolve();
      }
    };

    await Promise.all([reader(), reader(), reader(), reader(), swapper()]);

    expect(totalReads).toBeGreaterThan(0);
    expect(mixedReads).toBe(0);

    // After the final swap the store holds exactly one complete snapshot.
    const final = store.get()!;
    expect(final.items).toHaveLength(500);
    expect(new Set(final.items.map((i) => i.description)).size).toBe(1);
  });
});
