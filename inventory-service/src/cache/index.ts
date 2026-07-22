/**
 * cache/index.ts — driver selection (DEC-001, SVC-020). Config-only choice
 * between the in-memory and Redis stores.
 */
import { MemoryStore } from './memory';
import { RedisStore } from './redis';
import type { SnapshotStore } from './store';

export type { SnapshotStore } from './store';
export { MemoryStore } from './memory';
export { RedisStore } from './redis';

export async function makeStore(): Promise<SnapshotStore> {
  const driver = (process.env.CACHE_DRIVER ?? 'memory').toLowerCase();
  if (driver === 'redis') {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    return RedisStore.create(url);
  }
  return new MemoryStore();
}
