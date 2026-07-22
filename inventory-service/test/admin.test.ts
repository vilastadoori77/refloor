/**
 * admin.test.ts — TEST-018 admin endpoints reject unauthenticated mutation when
 * the production guard is enabled; local convenience path is explicit.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeApiDeps, startApp } from './helpers';
import type { RunningApp } from './helpers';

let running: RunningApp | null = null;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv.NODE_ENV = process.env.NODE_ENV;
  savedEnv.ADMIN_TOKEN = process.env.ADMIN_TOKEN;
});
afterEach(async () => {
  process.env.NODE_ENV = savedEnv.NODE_ENV;
  process.env.ADMIN_TOKEN = savedEnv.ADMIN_TOKEN;
  if (running) await running.close();
  running = null;
});

describe('TEST-018 admin guard (production)', () => {
  it('018.1 PUT /api/admin/config without token → 403, no config change', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_TOKEN = 'secret';
    const updateConfig = vi.fn((p) => ({ refreshSeconds: 60, ...p })) as never;
    running = await startApp(makeApiDeps({ updateConfig }));

    const res = await fetch(`${running.base}/api/admin/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshSeconds: 120 }),
    });
    expect([401, 403]).toContain(res.status);
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('018.2 POST /api/admin/refresh without token → rejected, no cycle triggered', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_TOKEN = 'secret';
    const triggerRefresh = vi.fn(async () => ({ ok: true }));
    running = await startApp(makeApiDeps({ triggerRefresh }));

    const res = await fetch(`${running.base}/api/admin/refresh`, { method: 'POST' });
    expect([401, 403]).toContain(res.status);
    expect(triggerRefresh).not.toHaveBeenCalled();
  });

  it('018.3 with correct token → 200, action performed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_TOKEN = 'secret';
    const triggerRefresh = vi.fn(async () => ({ ok: true }));
    const updateConfig = vi.fn((p) => ({ refreshSeconds: 60, ...p })) as never;
    running = await startApp(makeApiDeps({ triggerRefresh, updateConfig }));

    const refreshRes = await fetch(`${running.base}/api/admin/refresh`, {
      method: 'POST',
      headers: { 'X-Admin-Token': 'secret' },
    });
    expect(refreshRes.status).toBe(200);
    expect(triggerRefresh).toHaveBeenCalledTimes(1);

    const cfgRes = await fetch(`${running.base}/api/admin/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'X-Admin-Token': 'secret' },
      body: JSON.stringify({ refreshSeconds: 120 }),
    });
    expect(cfgRes.status).toBe(200);
    expect(updateConfig).toHaveBeenCalledTimes(1);
  });

  it('018.4 guard off (local default) → mutation allowed without token', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_TOKEN;
    const triggerRefresh = vi.fn(async () => ({ ok: true }));
    running = await startApp(makeApiDeps({ triggerRefresh }));

    const res = await fetch(`${running.base}/api/admin/refresh`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(triggerRefresh).toHaveBeenCalledTimes(1);
  });
});
