/**
 * cache/memory.ts — in-memory snapshot store (SVC-020 default).
 *
 * SVC-021 atomic swap: the whole snapshot is held behind a single reference.
 * `set` replaces that reference in one assignment, so a reader either sees the
 * complete old snapshot or the complete new one — never a partial mix.
 */
import type { Snapshot } from '@inventory/shared';
import type { SnapshotStore } from './store';

export class MemoryStore implements SnapshotStore {
  private current: Snapshot | null = null;

  get(): Snapshot | null {
    return this.current;
  }

  set(s: Snapshot): void {
    // Single-reference atomic swap.
    this.current = s;
  }
}
