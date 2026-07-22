/**
 * Mock BC API server (SPEC 01).
 *
 * Stands in for the Azure Middleware + Business Central layer. Serves the four
 * canonical `/BC/*` shapes plus mock-only extensions, all from an in-memory
 * dataset generated deterministically at startup (MOCK-004).
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { makeDataset } from './dataset';
import type { Dataset } from './dataset';
import { makeOutage } from './outage';
import type { OutageEndpoint } from './outage';

const PORT = Number(process.env.MOCK_PORT ?? 4000);
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 0);
const SEED = process.env.MOCK_SEED ?? '42';

// Dataset built once at startup; swappable via /admin/reseed (MOCK-072).
let db: Dataset = makeDataset(SEED);
const outage = makeOutage();

export const app = express();

app.use(cors());
app.use(express.json());

// X-Mock-Api on EVERY response (MOCK-061).
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Mock-Api', 'true');
  next();
});

// Request logging: method, path, status, duration ms (MOCK-006).
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
});

// Optional latency simulation (MOCK-007).
app.use((_req: Request, _res: Response, next: NextFunction) => {
  if (LATENCY_MS > 0) setTimeout(next, LATENCY_MS);
  else next();
});

function outageResponse(res: Response): void {
  res.status(500).json({ error: 'simulated outage' });
}

/**
 * Register a GET handler at both `/BC/<path>` and `/:auth/BC/<path>` so an
 * optional `refloor_auth=…` path segment is accepted and ignored (MOCK-003).
 * An `instance` query param is ignored automatically by Express.
 */
function bcGet(
  path: string,
  handler: (req: Request, res: Response) => void,
): void {
  app.get(`/BC/${path}`, handler);
  app.get(`/:auth/BC/${path}`, handler);
}

bcGet('GetInventory', (_req, res) => {
  if (outage.isDown('inventory')) return outageResponse(res);
  res.json(db.inventory);
});

bcGet('GetPurchaseOrders', (_req, res) => {
  if (outage.isDown('purchaseOrders')) return outageResponse(res);
  res.json(db.purchaseOrders);
});

bcGet('Demand', (_req, res) => {
  if (outage.isDown('demand')) return outageResponse(res);
  res.json(db.demand);
});

bcGet('GetInventoryByProject/:projectNo', (req, res) => {
  if (outage.isDown('project')) return outageResponse(res);
  const proj = db.projects.get(req.params.projectNo);
  if (!proj) return res.status(404).json({ error: 'project not found' });
  res.json(proj);
});

// Mock-only sale headers (MOCK-060), non-canonical `_mock/` prefix.
bcGet('_mock/GetProjects', (_req, res) => {
  res.json(db.saleHeaders);
});

// ── Admin: outage switch + reseed (MOCK-070 … MOCK-072).
app.get('/admin/outage', (_req, res) => {
  res.json(outage.getState());
});

app.post('/admin/outage', (req, res) => {
  const body = (req.body ?? {}) as { enabled?: boolean; endpoints?: OutageEndpoint[] };
  const state = outage.setOutage(Boolean(body.enabled), body.endpoints);
  res.json(state);
});

app.post('/admin/reseed', (req, res) => {
  const body = (req.body ?? {}) as { seed?: string | number };
  const seed = String(body.seed ?? SEED);
  db = makeDataset(seed);
  res.json({
    seed,
    counts: {
      inventory: db.inventory.length,
      purchaseOrders: db.purchaseOrders.length,
      demand: db.demand.length,
      projects: db.projects.size,
    },
  });
});

// Start the listener only when run directly (not when imported by tests).
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Mock BC API listening on http://localhost:${PORT} (seed=${SEED})`);
  });
}
