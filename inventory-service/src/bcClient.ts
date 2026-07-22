/**
 * bcClient.ts — typed clients for the (mock) middleware feeds (SVC-001/006/043).
 *
 * - global `fetch`, per-call 10s timeout via AbortController (SVC-006).
 * - BC_AUTH_TOKEN inserted as a header when set (SVC-043) and NEVER returned or
 *   logged (SVC-044) — it stays inside this module.
 * - base URL + fetch impl are injectable so tests can stub without a server.
 * - withRetry(fn, {attempts, backoffMs}) helper (SVC-012) for the worker.
 */
import type {
  BcInventoryRow,
  BcPurchaseOrderRow,
  BcDemandRow,
  BcProjectResponse,
  SaleHeader,
} from '@inventory/shared';
import { log } from './log';

const TIMEOUT_MS = 10_000;

export interface BcClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  authToken?: string;
}

export interface BcClient {
  getInventory(): Promise<BcInventoryRow[]>;
  getPurchaseOrders(): Promise<BcPurchaseOrderRow[]>;
  getDemand(): Promise<BcDemandRow[]>;
  getInventoryByProject(projectNo: string): Promise<BcProjectResponse>;
  getProjects(): Promise<SaleHeader[]>;
}

export function makeBcClient(opts: BcClientOptions = {}): BcClient {
  const baseUrl = (opts.baseUrl ?? process.env.BC_BASE_URL ?? 'http://localhost:4000').replace(
    /\/+$/,
    '',
  );
  const doFetch = opts.fetchImpl ?? fetch;
  // SVC-044: token is captured in this closure only — never surfaced.
  const authToken = opts.authToken ?? process.env.BC_AUTH_TOKEN;

  async function getJson<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (authToken) headers.authorization = `Bearer ${authToken}`; // SVC-043
    try {
      const res = await doFetch(`${baseUrl}${path}`, {
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`BC request ${path} failed with status ${res.status}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    getInventory: () => getJson<BcInventoryRow[]>('/BC/GetInventory'),
    getPurchaseOrders: () => getJson<BcPurchaseOrderRow[]>('/BC/GetPurchaseOrders'),
    getDemand: () => getJson<BcDemandRow[]>('/BC/Demand'),
    getInventoryByProject: (projectNo: string) =>
      getJson<BcProjectResponse>(`/BC/GetInventoryByProject/${encodeURIComponent(projectNo)}`),
    getProjects: () => getJson<SaleHeader[]>('/BC/_mock/GetProjects'),
  };
}

export interface RetryOptions {
  attempts?: number;
  backoffMs?: number[];
  /** Injectable delay so tests can drive fake timers. */
  sleep?: (ms: number) => Promise<void>;
  label?: string;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * SVC-012: run `fn`, retrying up to `attempts` times with exponential backoff
 * (default 1s/2s/4s between the 3 attempts). Rethrows the last error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const backoffMs = options.backoffMs ?? [1000, 2000, 4000];
  const sleep = options.sleep ?? defaultSleep;
  const label = options.label ?? 'operation';

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        const wait = backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 1000;
        log.warn('bc.retry', {
          label,
          attempt,
          nextRetryMs: wait,
          message: err instanceof Error ? err.message : String(err),
        });
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}
