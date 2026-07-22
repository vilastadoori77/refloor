/**
 * alerts.ts — pluggable alert sink (SVC-031, ASM-010).
 *
 * Fired on refresh failure and on recovery. Console locally; on Azure a
 * different sink (Azure Monitor → email) can be dropped in without touching
 * the worker. Consecutive-failure count is included in the payload.
 */
import { log } from './log';

export interface AlertInfo {
  consecutiveFailures: number;
  detail?: Record<string, unknown>;
}

export interface AlertSink {
  fail(info: AlertInfo): void;
  recover(info: AlertInfo): void;
}

export class ConsoleAlertSink implements AlertSink {
  fail(info: AlertInfo): void {
    log.error('alert.refresh_failed', {
      consecutiveFailures: info.consecutiveFailures,
      ...(info.detail ?? {}),
    });
  }

  recover(info: AlertInfo): void {
    log.info('alert.refresh_recovered', {
      consecutiveFailures: info.consecutiveFailures,
      ...(info.detail ?? {}),
    });
  }
}
