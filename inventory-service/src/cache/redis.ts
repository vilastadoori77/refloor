/**
 * cache/redis.ts — Redis snapshot store (SVC-020, CACHE_DRIVER=redis).
 *
 * `ioredis` is an optional dependency and may be absent, so it is imported
 * dynamically and guarded. The whole snapshot is serialized to JSON and written
 * with a single atomic SET (SVC-021).
 */
import type { Snapshot } from '@inventory/shared';
import type { SnapshotStore } from './store';

const KEY = 'inventory:snapshot';

// Minimal structural type so we don't hard-depend on ioredis' types at compile.
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

export class RedisStore implements SnapshotStore {
  private constructor(private readonly client: RedisLike) {}

  static async create(url: string): Promise<RedisStore> {
    let mod: { default: new (url: string) => RedisLike };
    try {
      mod = (await import('ioredis')) as unknown as {
        default: new (url: string) => RedisLike;
      };
    } catch {
      throw new Error(
        "CACHE_DRIVER=redis but the 'ioredis' package is not installed. " +
          'Install ioredis or use CACHE_DRIVER=memory.',
      );
    }
    const Ctor = mod.default;
    const client = new Ctor(url);
    return new RedisStore(client);
  }

  async get(): Promise<Snapshot | null> {
    const raw = await this.client.get(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  }

  async set(s: Snapshot): Promise<void> {
    // Single JSON blob, one SET → atomic publish.
    await this.client.set(KEY, JSON.stringify(s));
  }
}
