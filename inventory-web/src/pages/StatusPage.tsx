import { useEffect, useMemo, useState } from 'react';
import type { SourceKey, StatusResponse } from '@inventory/shared';
import { getStatus, putConfig } from '../api';
import type { Filters } from '../components/InventoryFilters';
import { InventoryGrid } from '../components/InventoryGrid';
import { formatTimestamp } from '../format';
import { useInventory } from '../hooks/useInventory';

// Inventory Status screen (ASM-007 = Both, WEB-060…063):
//   - Primary  : cross-satellite shortage board (yellow/red rows from /api/inventory).
//   - Secondary: compact service-health widget from /api/status.
export function StatusPage({
  filters,
  reload,
  setRefreshedAt,
}: {
  filters: Filters;
  reload: number;
  setRefreshedAt: (iso: string) => void;
}) {
  const { items, loading, error } = useInventory(filters, reload, setRefreshedAt);

  // Shortage board: only rows below threshold (status yellow or red) — WEB-060.
  const shortages = useMemo(() => items.filter((it) => it.status !== 'green'), [items]);

  return (
    <div>
      <h1 className="page-title">Inventory Status</h1>
      <p className="page-caption">
        Cross-satellite shortage board plus service health. Rows appear here when an
        item&apos;s availability falls below the configured threshold.
      </p>

      <HealthWidget reload={reload} />

      <div className="section-block">
        <h2 className="section-title">Shortage Board</h2>
        {error && <div className="banner-error">Failed to load inventory: {error}</div>}
        {loading && items.length === 0 ? (
          <div className="loading-note">Loading shortage board…</div>
        ) : shortages.length === 0 ? (
          <div className="empty-state">
            ✓ No items are below threshold for the current filters. Everything is in the green.
          </div>
        ) : (
          <InventoryGrid items={shortages} mode="flat" />
        )}
      </div>
    </div>
  );
}

const SOURCE_KEYS: SourceKey[] = ['inventory', 'purchaseOrders', 'demand'];
const HEALTH_POLL_MS = 15_000;

// WEB-061/062/063 — health widget.
function HealthWidget({ reload }: { reload: number }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [draftSeconds, setDraftSeconds] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const poll = () =>
      getStatus()
        .then((s) => active && setStatus(s))
        .catch(() => {
          /* keep last known status on failure */
        });
    poll();
    const id = setInterval(poll, HEALTH_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
    // Re-poll immediately when the cache-only reload counter changes (WEB-006).
  }, [reload]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const stale = useMemo(() => {
    if (!status) return false;
    const ts = new Date(status.refreshedAt).getTime();
    if (Number.isNaN(ts)) return false;
    return now - ts > 2 * status.refreshSeconds * 1000;
  }, [status, now]);

  async function applyRefreshSeconds() {
    const n = Number(draftSeconds);
    if (!Number.isFinite(n) || n <= 0) {
      setSaveMsg('Enter a positive number of seconds.');
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      await putConfig({ refreshSeconds: n });
      setSaveMsg('Saved. Cadence updated.');
      const s = await getStatus();
      setStatus(s);
      setDraftSeconds('');
    } catch {
      setSaveMsg('Failed to update (admin-protected).');
    } finally {
      setSaving(false);
    }
  }

  if (!status) {
    return (
      <div className="section-block">
        <h2 className="section-title">Service Health</h2>
        <div className="loading-note">Loading service status…</div>
      </div>
    );
  }

  return (
    <div className="section-block">
      <div className="inline-badges" style={{ marginBottom: 10 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Service Health
        </h2>
        {!status.healthy && <span className="stale-badge" style={{ background: 'var(--status-red)' }}>Unhealthy</span>}
        {stale && <span className="stale-badge">Stale</span>}
      </div>

      {!status.healthy && (
        <div className="banner-error">
          Service is UNHEALTHY — {status.consecutiveFailures} consecutive refresh failure(s).
        </div>
      )}

      <div className="health-grid">
        <Stat k="Overall Health" v={status.healthy ? 'Healthy' : 'Unhealthy'} good={status.healthy} bad={!status.healthy} />
        <Stat k="Last Successful Refresh" v={formatTimestamp(status.refreshedAt)} />
        <Stat k="Last Attempt" v={formatTimestamp(status.lastAttemptAt)} />
        <Stat
          k="Consecutive Failures"
          v={String(status.consecutiveFailures)}
          bad={status.consecutiveFailures > 0}
        />
        <Stat k="Refresh Interval" v={`${status.refreshSeconds}s`} />
      </div>

      <div className="grid-wrap" style={{ marginTop: 12 }}>
        <table className="grid">
          <thead>
            <tr>
              <th>Source</th>
              <th>Status</th>
              <th className="num">Row Count</th>
            </tr>
          </thead>
          <tbody>
            {SOURCE_KEYS.map((key) => {
              const s = status.sources[key];
              return (
                <tr key={key}>
                  <td>{key}</td>
                  <td style={{ color: s?.status === 'ok' ? 'var(--status-green)' : 'var(--status-red)', fontWeight: 700 }}>
                    {s ? s.status.toUpperCase() : 'N/A'}
                  </td>
                  <td className="num">{s ? s.rowCount.toLocaleString('en-US') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* WEB-063 (Should) — admin control for refreshSeconds, kept clearly
          separate from the header's cache-only refresh. PUTs /api/admin/config. */}
      <div className="panel" style={{ marginTop: 12 }}>
        <h3 className="panel-title">Admin — Refresh Cadence</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            min={1}
            style={{ width: 140 }}
            placeholder={`${status.refreshSeconds}`}
            value={draftSeconds}
            onChange={(e) => setDraftSeconds(e.target.value)}
          />
          <button type="button" className="btn" disabled={saving} onClick={applyRefreshSeconds}>
            {saving ? 'Saving…' : 'Update interval'}
          </button>
          {saveMsg && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{saveMsg}</span>}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, good, bad }: { k: string; v: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="health-stat">
      <div className="k">{k}</div>
      <div className={`v${good ? ' good' : ''}${bad ? ' bad' : ''}`}>{v}</div>
    </div>
  );
}
