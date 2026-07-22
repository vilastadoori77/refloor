/**
 * config.ts — the ONE source of business rules (PB-001 guardrail, SPEC 00 §5).
 *
 * Holds a single mutable `AvailabilityConfig` seeded from the shared
 * DEFAULT_CONFIG so the service and its tests read the same defaults
 * (TEST-016). `refreshSeconds` is overridable from the REFRESH_SECONDS env.
 * Every consumer reads the formula/thresholds from here — nothing hard-coded.
 */
import { DEFAULT_CONFIG } from '@inventory/shared';
import type { AvailabilityConfig, AvailabilityStrategy } from '@inventory/shared';

const VALID_STRATEGIES: AvailabilityStrategy[] = [
  'onHandMinusAllocated',
  'netInventory',
];

function readRefreshSecondsEnv(): number | undefined {
  const raw = process.env.REFRESH_SECONDS;
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Deep clone so mutations never leak back into the shared DEFAULT_CONFIG object.
function cloneConfig(c: AvailabilityConfig): AvailabilityConfig {
  return {
    refreshSeconds: c.refreshSeconds,
    availabilityStrategy: c.availabilityStrategy,
    thresholds: { ...c.thresholds },
    projectStatusStrategy: c.projectStatusStrategy,
  };
}

let current: AvailabilityConfig = cloneConfig(DEFAULT_CONFIG);
const envRefresh = readRefreshSecondsEnv();
if (envRefresh !== undefined) current.refreshSeconds = envRefresh;

/** Current live config. Callers must treat the returned object as read-only. */
export function getConfig(): AvailabilityConfig {
  return current;
}

/**
 * SVC-011: validate + merge a partial config update, taking effect from the
 * next cycle. Throws on invalid input so the admin endpoint can 400.
 */
export function updateConfig(partial: Partial<AvailabilityConfig>): AvailabilityConfig {
  const next = cloneConfig(current);

  if (partial.refreshSeconds !== undefined) {
    const n = partial.refreshSeconds;
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
      throw new Error('refreshSeconds must be a positive number');
    }
    next.refreshSeconds = n;
  }

  if (partial.availabilityStrategy !== undefined) {
    if (!VALID_STRATEGIES.includes(partial.availabilityStrategy)) {
      throw new Error(`availabilityStrategy must be one of ${VALID_STRATEGIES.join(', ')}`);
    }
    next.availabilityStrategy = partial.availabilityStrategy;
  }

  if (partial.projectStatusStrategy !== undefined) {
    if (partial.projectStatusStrategy !== 'availabilityVsRequired') {
      throw new Error('projectStatusStrategy must be availabilityVsRequired');
    }
    next.projectStatusStrategy = partial.projectStatusStrategy;
  }

  if (partial.thresholds !== undefined) {
    const t = partial.thresholds;
    const merged = { ...next.thresholds };
    for (const key of [
      'redBelow',
      'yellowFractionOfAllocated',
      'yellowMinUnitsWhenNoAllocated',
    ] as const) {
      if (t[key] !== undefined) {
        const v = t[key];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          throw new Error(`thresholds.${key} must be a finite number`);
        }
        merged[key] = v;
      }
    }
    next.thresholds = merged;
  }

  current = next;
  return current;
}

/** Test-only: reset config back to defaults (+ env override). */
export function resetConfig(): AvailabilityConfig {
  current = cloneConfig(DEFAULT_CONFIG);
  const env = readRefreshSecondsEnv();
  if (env !== undefined) current.refreshSeconds = env;
  return current;
}
