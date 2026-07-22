/**
 * cache/store.ts — the snapshot store abstraction (SVC-020).
 * Two implementations back it: in-memory (default) and Redis. A SQL driver
 * could be added later without touching consumers.
 */
import type { Snapshot } from '@inventory/shared';

export interface SnapshotStore {
  /** Return the current snapshot, or null if none published yet. */
  get(): Snapshot | null | Promise<Snapshot | null>;
  /** Atomically publish a complete snapshot (SVC-021). */
  set(s: Snapshot): void | Promise<void>;
}
