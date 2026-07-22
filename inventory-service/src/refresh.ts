/**
 * refresh.ts — the refresh worker (SVC-010…015).
 *
 * runCycle: fetch the 3 feeds, each withRetry (SVC-012). If ALL succeed, build a
 * brand-new complete Snapshot and atomically publish it (SVC-021). If ANY feed
 * fails after retries, mark the cycle failed, KEEP the previous snapshot
 * unchanged including its refreshedAt (SVC-014), bump consecutiveFailures,
 * update health/history and fire the alert sink (SVC-031). Every cycle logs
 * start, per-feed outcome, row counts, duration, success/failure (SVC-013).
 *
 * startRefreshLoop reschedules via setTimeout reading config.refreshSeconds each
 * cycle, so the interval is runtime-configurable (SVC-010/011).
 */
import type {
  AvailabilityConfig,
  Snapshot,
  SourceKey,
  SourceOutcome,
} from '@inventory/shared';
import type { SnapshotStore } from './cache/store';
import type { BcClient } from './bcClient';
import type { AlertSink } from './alerts';
import type { Health } from './health';
import { withRetry } from './bcClient';
import { consolidate } from './consolidator';
import { log } from './log';

export interface RefreshDeps {
  client: BcClient;
  health: Health;
  alerts: AlertSink;
  /** Injectable backoff delay so tests can drive fake timers. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable clock for deterministic timestamps. */
  now?: () => Date;
}

export interface CycleResult {
  ok: boolean;
}

function outcome(status: 'ok' | 'failed', rowCount: number): SourceOutcome {
  return { status, rowCount };
}

export async function runCycle(
  store: SnapshotStore,
  config: AvailabilityConfig,
  deps: RefreshDeps,
): Promise<CycleResult> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep;
  const startedMs = Date.now();
  log.info('refresh.start', { at: now().toISOString() });

  const [invR, poR, demR] = await Promise.allSettled([
    withRetry(() => deps.client.getInventory(), { sleep, label: 'inventory' }),
    withRetry(() => deps.client.getPurchaseOrders(), { sleep, label: 'purchaseOrders' }),
    withRetry(() => deps.client.getDemand(), { sleep, label: 'demand' }),
  ]);

  const durationMs = Date.now() - startedMs;
  const at = now().toISOString();

  const sources: Record<SourceKey, SourceOutcome> = {
    inventory:
      invR.status === 'fulfilled'
        ? outcome('ok', invR.value.length)
        : outcome('failed', 0),
    purchaseOrders:
      poR.status === 'fulfilled'
        ? outcome('ok', poR.value.length)
        : outcome('failed', 0),
    demand:
      demR.status === 'fulfilled'
        ? outcome('ok', demR.value.length)
        : outcome('failed', 0),
  };

  const allOk =
    invR.status === 'fulfilled' &&
    poR.status === 'fulfilled' &&
    demR.status === 'fulfilled';

  // Per-feed outcome logging (SVC-013).
  log.info('refresh.feeds', {
    durationMs,
    inventory: sources.inventory,
    purchaseOrders: sources.purchaseOrders,
    demand: sources.demand,
  });

  const prevFailures = deps.health.getConsecutiveFailures();

  if (allOk && invR.status === 'fulfilled' && poR.status === 'fulfilled' && demR.status === 'fulfilled') {
    const snapshot: Snapshot = {
      refreshedAt: at,
      lastAttemptAt: at,
      healthy: true,
      consecutiveFailures: 0,
      sources,
      items: consolidate(invR.value, poR.value, demR.value, config),
    };
    // SVC-021 atomic publish.
    await store.set(snapshot);
    deps.health.record({ at, ok: true, durationMs, sources });

    if (prevFailures > 0) {
      deps.alerts.recover({
        consecutiveFailures: 0,
        detail: { recoveredAfter: prevFailures },
      });
    }
    log.info('refresh.success', {
      at,
      durationMs,
      items: snapshot.items.length,
    });
    return { ok: true };
  }

  // SVC-014: any feed failed → keep previous snapshot unchanged.
  deps.health.record({ at, ok: false, durationMs, sources });
  const consecutiveFailures = deps.health.getConsecutiveFailures();
  deps.alerts.fail({
    consecutiveFailures,
    detail: { at, durationMs, sources },
  });
  log.error('refresh.failed', { at, durationMs, consecutiveFailures, sources });
  return { ok: false };
}

export interface RefreshLoopHandle {
  stop(): void;
  /** Trigger an immediate out-of-band cycle (SVC-015). */
  triggerNow(): Promise<CycleResult>;
}

export function startRefreshLoop(
  store: SnapshotStore,
  getConfig: () => AvailabilityConfig,
  deps: RefreshDeps,
): RefreshLoopHandle {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let running: Promise<CycleResult> | null = null;

  const runOnce = async (): Promise<CycleResult> => {
    // Serialize so an out-of-band trigger never overlaps a scheduled cycle.
    if (running) return running;
    running = runCycle(store, getConfig(), deps).catch((err): CycleResult => {
      log.error('refresh.cycle_error', {
        message: err instanceof Error ? err.message : String(err),
      });
      return { ok: false };
    });
    try {
      return await running;
    } finally {
      running = null;
    }
  };

  const schedule = (): void => {
    if (stopped) return;
    const secs = getConfig().refreshSeconds;
    timer = setTimeout(tick, secs * 1000);
  };

  const tick = async (): Promise<void> => {
    if (stopped) return;
    await runOnce();
    schedule();
  };

  schedule();

  return {
    stop(): void {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    triggerNow(): Promise<CycleResult> {
      return runOnce();
    },
  };
}
