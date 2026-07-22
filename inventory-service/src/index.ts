/**
 * index.ts — service composition root.
 *
 * Builds the store, runs an initial refresh cycle, starts the refresh loop,
 * mounts the API and (when run as the entrypoint) listens. `buildService` is
 * exported so tests can compose the app with real or stubbed pieces.
 */
import { fileURLToPath } from 'node:url';
import express from 'express';
import { getConfig, updateConfig } from './config';
import { makeStore } from './cache/index';
import type { SnapshotStore } from './cache/store';
import { makeBcClient } from './bcClient';
import type { BcClient } from './bcClient';
import { ConsoleAlertSink } from './alerts';
import type { AlertSink } from './alerts';
import { Health } from './health';
import { runCycle, startRefreshLoop } from './refresh';
import type { RefreshLoopHandle } from './refresh';
import { createApp } from './api';
import { log } from './log';

export interface BuiltService {
  app: express.Express;
  store: SnapshotStore;
  health: Health;
  loop: RefreshLoopHandle;
}

export interface BuildOptions {
  store?: SnapshotStore;
  client?: BcClient;
  alerts?: AlertSink;
  runInitialCycle?: boolean;
  startLoop?: boolean;
}

export async function buildService(opts: BuildOptions = {}): Promise<BuiltService> {
  const store = opts.store ?? (await makeStore());
  const client = opts.client ?? makeBcClient();
  const alerts = opts.alerts ?? new ConsoleAlertSink();
  const health = new Health();
  const deps = { client, health, alerts };

  if (opts.runInitialCycle ?? true) {
    await runCycle(store, getConfig(), deps);
  }

  const loop = startRefreshLoop(store, getConfig, deps);
  if (!(opts.startLoop ?? true)) {
    loop.stop();
  }

  const app = createApp({
    store,
    getConfig,
    updateConfig,
    health,
    client,
    triggerRefresh: () => loop.triggerNow(),
  });

  return { app, store, health, loop };
}

const isMain = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  buildService()
    .then(({ app }) => {
      const port = process.env.PORT ?? 4100;
      app.listen(Number(port), () => {
        log.info('service.listening', { port: Number(port) });
      });
    })
    .catch((err: unknown) => {
      log.error('service.boot_failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      process.exitCode = 1;
    });
}
