/**
 * health.ts — mutable health/history state for the refresh worker (SVC-032).
 *
 * Distinct from the snapshot: a FAILED cycle keeps the snapshot (and its
 * refreshedAt) frozen (SVC-014), but the attempt-level health here still
 * advances (lastAttemptAt, healthy, consecutiveFailures, sources, history).
 * `getStatus` joins the frozen snapshot's refreshedAt with live health.
 */
import type {
  AvailabilityConfig,
  RefreshHistoryEntry,
  SourceKey,
  SourceOutcome,
  StatusResponse,
} from '@inventory/shared';
import type { SnapshotStore } from './cache/store';

const HISTORY_LIMIT = 20;

function emptySources(): Record<SourceKey, SourceOutcome> {
  return {
    inventory: { status: 'failed', rowCount: 0 },
    purchaseOrders: { status: 'failed', rowCount: 0 },
    demand: { status: 'failed', rowCount: 0 },
  };
}

export interface CycleOutcome {
  at: string;
  ok: boolean;
  durationMs: number;
  sources: Record<SourceKey, SourceOutcome>;
}

export class Health {
  private lastAttemptAt = '';
  private healthy = false;
  private consecutiveFailures = 0;
  private sources: Record<SourceKey, SourceOutcome> = emptySources();
  private history: RefreshHistoryEntry[] = [];

  record(outcome: CycleOutcome): void {
    this.lastAttemptAt = outcome.at;
    this.healthy = outcome.ok;
    this.sources = outcome.sources;
    if (outcome.ok) this.consecutiveFailures = 0;
    else this.consecutiveFailures += 1;

    this.history.push({
      at: outcome.at,
      ok: outcome.ok,
      durationMs: outcome.durationMs,
      rowCounts: {
        inventory: outcome.sources.inventory.rowCount,
        purchaseOrders: outcome.sources.purchaseOrders.rowCount,
        demand: outcome.sources.demand.rowCount,
      },
    });
    if (this.history.length > HISTORY_LIMIT) {
      this.history = this.history.slice(-HISTORY_LIMIT);
    }
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  async getStatus(
    config: AvailabilityConfig,
    store: SnapshotStore,
  ): Promise<StatusResponse> {
    const snap = await store.get();
    return {
      refreshedAt: snap?.refreshedAt ?? '',
      lastAttemptAt: this.lastAttemptAt,
      healthy: this.healthy,
      consecutiveFailures: this.consecutiveFailures,
      refreshSeconds: config.refreshSeconds,
      sources: this.sources,
      history: this.history.slice(),
    };
  }
}
