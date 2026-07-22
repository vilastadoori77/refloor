/**
 * api.ts — internal API for the website (SVC-040…045).
 *
 * Every /api response uses the envelope { refreshedAt, data } (SVC-022), except
 * /api/status which has its own defined shape (SVC-032). CORS is restricted to
 * WEB_ORIGIN. The service never echoes BC_BASE_URL / BC_AUTH_TOKEN (SVC-044).
 */
import express from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import { SATELLITES } from '@inventory/shared';
import type {
  AvailabilityConfig,
  ConsolidatedItem,
  LocationOption,
  ProjectItemRow,
  ProjectTotals,
  ProjectView,
  SaleHeader,
  Snapshot,
} from '@inventory/shared';
import type { SnapshotStore } from './cache/store';
import type { BcClient } from './bcClient';
import type { Health } from './health';
import { projectItemStatus } from './consolidator';
import { log } from './log';

export interface ApiDeps {
  store: SnapshotStore;
  getConfig: () => AvailabilityConfig;
  updateConfig: (partial: Partial<AvailabilityConfig>) => AvailabilityConfig;
  health: Health;
  client: BcClient;
  /** Trigger an immediate out-of-band refresh cycle (SVC-015). */
  triggerRefresh: () => Promise<{ ok: boolean }>;
}

function wrap(fn: (req: Request, res: Response) => Promise<void> | void): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

async function currentSnapshot(store: SnapshotStore): Promise<Snapshot | null> {
  return store.get();
}

function envelope<T>(refreshedAt: string, data: T): { refreshedAt: string; data: T } {
  return { refreshedAt, data };
}

/**
 * SVC-045: admin guard. Enforced only when NODE_ENV==='production'; locally the
 * check is off by default (dev convenience) but the guard code exists so cloud
 * deployment is never an open mutation surface. Env is read per-request.
 */
function adminGuard(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }
  const expected = process.env.ADMIN_TOKEN;
  const provided = req.header('X-Admin-Token');
  if (!expected || provided !== expected) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

function emptyTotals(): ProjectTotals {
  return { required: 0, available: 0, ordered: 0, picked: 0, remainder: 0 };
}

function sumTotals(rows: ProjectItemRow[]): ProjectTotals {
  return rows.reduce<ProjectTotals>((acc, r) => {
    acc.required += r.required;
    acc.available += r.available;
    acc.ordered += r.ordered;
    acc.picked += r.picked;
    acc.remainder += r.remainder;
    return acc;
  }, emptyTotals());
}

export function createApp(deps: ApiDeps): express.Express {
  const app = express();
  app.use(express.json());

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  app.use(cors({ origin: webOrigin }));

  // SVC-033 liveness probe (not under /api, no envelope).
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  const api = express.Router();

  // SVC-040 — consolidated inventory with filters.
  api.get(
    '/inventory',
    wrap(async (req, res) => {
      const snap = await currentSnapshot(deps.store);
      let items: ConsolidatedItem[] = snap?.items ?? [];

      const location = req.query.location;
      const category = req.query.category;
      const search = req.query.search;

      if (typeof location === 'string' && location !== '') {
        items = items.filter((i) => i.locationCode === location);
      }
      if (typeof category === 'string' && category !== '') {
        items = items.filter((i) => i.itemCategoryCode === category);
      }
      if (typeof search === 'string' && search.trim() !== '') {
        const q = search.toLowerCase();
        items = items.filter(
          (i) =>
            i.itemNo.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q),
        );
      }

      res.json(envelope(snap?.refreshedAt ?? '', items));
    }),
  );

  // SVC-041 — location options (SATELLITES present in the data).
  api.get(
    '/locations',
    wrap(async (_req, res) => {
      const snap = await currentSnapshot(deps.store);
      const present = new Set((snap?.items ?? []).map((i) => i.locationCode));
      const options: LocationOption[] = SATELLITES.filter((s) => present.has(s.code));
      res.json(envelope(snap?.refreshedAt ?? '', options));
    }),
  );

  // SVC-041 — distinct categories.
  api.get(
    '/categories',
    wrap(async (_req, res) => {
      const snap = await currentSnapshot(deps.store);
      const set = new Set<string>();
      for (const i of snap?.items ?? []) {
        if (i.itemCategoryCode) set.add(i.itemCategoryCode);
      }
      const categories = Array.from(set).sort();
      res.json(envelope(snap?.refreshedAt ?? '', categories));
    }),
  );

  // SVC-042 — sale-header list (proxied from MOCK-060, replica-only).
  api.get(
    '/projects',
    wrap(async (_req, res) => {
      const snap = await currentSnapshot(deps.store);
      let headers: SaleHeader[];
      try {
        headers = await deps.client.getProjects();
      } catch {
        res.status(503).json({ error: 'project source unavailable' });
        return;
      }
      res.json(envelope(snap?.refreshedAt ?? '', headers));
    }),
  );

  // SVC-042 — single project view (live fetch + snapshot join).
  api.get(
    '/projects/:projectNo',
    wrap(async (req, res) => {
      const projectNo = req.params.projectNo;
      const config = deps.getConfig();
      const snap = await currentSnapshot(deps.store);

      // SVC-042a: live project fetch failure → 503, NO stale data.
      let project;
      try {
        project = await deps.client.getInventoryByProject(projectNo);
      } catch {
        res.status(503).json({ error: 'project source unavailable' });
        return;
      }

      // Sale header is best-effort (replica-only source); its absence must not
      // 503 the whole view — only the project fetch failure does (SVC-042a).
      let header: SaleHeader | null = null;
      try {
        const headers = await deps.client.getProjects();
        header = headers.find((h) => h.projectNo === projectNo) ?? null;
      } catch {
        header = null;
      }

      const items = snap?.items ?? [];
      const findRow = (itemNo: string, locationCode: string): ConsolidatedItem | undefined =>
        items.find((i) => i.itemNo === itemNo && i.locationCode === locationCode);

      const flooring: ProjectItemRow[] = [];
      const additional: ProjectItemRow[] = [];

      for (const it of project.items) {
        // Snapshot join uses the project's satellite location (SVC-042); fall
        // back to the item's own locationCode when the header is unavailable.
        const locationCode = header?.satelliteCode ?? it.locationCode ?? 'UNK';
        const row = findRow(it.no, locationCode);
        const available = row?.available ?? 0;
        const ordered = row?.ordered ?? 0;
        const picked = 0; // ASM-004
        const { itemStatus, remainder } = projectItemStatus(config, {
          required: it.required,
          available,
          ordered,
          picked,
        });
        const projectRow: ProjectItemRow = {
          product: it.description,
          itemCategory: it.itemCategoryCode,
          required: it.required,
          available,
          ordered,
          picked,
          remainder,
          itemStatus,
        };
        if (it.itemCategoryCode === 'FLOORING') flooring.push(projectRow);
        else additional.push(projectRow);
      }

      const view: ProjectView = {
        header,
        refreshedAt: snap?.refreshedAt ?? '',
        flooring,
        additional,
        totals: { flooring: sumTotals(flooring), additional: sumTotals(additional) },
        status: {
          flooringReady: flooring.every((r) => r.itemStatus === 'ready'),
          additionalReady: additional.every((r) => r.itemStatus === 'ready'),
        },
      };

      res.json(envelope(snap?.refreshedAt ?? '', view));
    }),
  );

  // SVC-032 — dashboard status (own shape, not enveloped).
  api.get(
    '/status',
    wrap(async (_req, res) => {
      const status = await deps.health.getStatus(deps.getConfig(), deps.store);
      res.json(status);
    }),
  );

  // SVC-015 — immediate out-of-band refresh (admin-guarded).
  api.post(
    '/admin/refresh',
    adminGuard,
    wrap(async (_req, res) => {
      const result = await deps.triggerRefresh();
      const snap = await currentSnapshot(deps.store);
      res.json(envelope(snap?.refreshedAt ?? '', { triggered: true, ok: result.ok }));
    }),
  );

  // SVC-011 — runtime config update (admin-guarded).
  api.put(
    '/admin/config',
    adminGuard,
    wrap(async (req, res) => {
      try {
        const updated = deps.updateConfig((req.body ?? {}) as Partial<AvailabilityConfig>);
        const snap = await currentSnapshot(deps.store);
        res.json(envelope(snap?.refreshedAt ?? '', updated));
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'invalid config',
        });
      }
    }),
  );

  app.use('/api', api);

  // Fallback error handler — never leak internal env/values (SVC-044).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error('api.error', { message: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}
