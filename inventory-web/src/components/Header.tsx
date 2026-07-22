import { useEffect, useState } from 'react';
import { getStatus } from '../api';
import { formatDateTime, formatTimestamp } from '../format';

// App header (WEB-004/005/006).
//   - Title "Inventory Dashboard" / divider / subtitle "Analytics & Project Search".
//   - Right: cache-only refresh icon + live clock + "Last Updated" + stale badge.
//   - Polls GET /api/status every 15s to keep "Last Updated" (refreshedAt) fresh
//     and to know refreshSeconds for the stale threshold (2× refresh interval).

interface Props {
  refreshedAt: string | null;
  setRefreshedAt: (iso: string) => void;
  onRefresh: () => void;
}

const STATUS_POLL_MS = 15_000; // WEB-005
const CLOCK_TICK_MS = 10_000;

export function Header({ refreshedAt, setRefreshedAt, onRefresh }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [refreshSeconds, setRefreshSeconds] = useState<number>(60);

  // Live clock + periodic re-render so the stale badge can appear as time passes.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Poll /api/status every 15s: refresh "Last Updated" and read refreshSeconds.
  useEffect(() => {
    let active = true;
    const poll = () => {
      getStatus()
        .then((s) => {
          if (!active) return;
          setRefreshedAt(s.refreshedAt);
          setRefreshSeconds(s.refreshSeconds);
        })
        .catch(() => {
          /* header keeps last known values on a failed poll */
        });
    };
    poll();
    const id = setInterval(poll, STATUS_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [setRefreshedAt]);

  // Stale when refreshedAt is older than 2× the refresh interval (WEB-005).
  const stale = (() => {
    if (!refreshedAt) return false;
    const ts = new Date(refreshedAt).getTime();
    if (Number.isNaN(ts)) return false;
    return now.getTime() - ts > 2 * refreshSeconds * 1000;
  })();

  // WEB-006 — CACHE-ONLY REFRESH. Clicking this icon re-reads the current cached
  // snapshot via the normal /api/* reads (it bumps a reload counter in App that
  // the pages depend on). It MUST NOT call POST /api/admin/refresh and MUST NOT
  // advance refreshedAt / "Last Updated" — that timestamp only moves when a
  // service refresh cycle (SVC-010) completes.
  const handleRefreshClick = () => {
    onRefresh();
  };

  return (
    <header className="header app-header">
      <div className="header-titles">
        <span className="header-title">Inventory Dashboard</span>
        <span className="header-divider" />
        <span className="header-subtitle">Analytics &amp; Project Search</span>
      </div>

      <div className="header-right">
        {stale && <span className="stale-badge" title="Data older than 2× the refresh interval">Stale</span>}
        <div className="header-updated">
          <div className="label">Last Updated</div>
          <div className="value">{formatTimestamp(refreshedAt)}</div>
        </div>
        <div className="header-clock">{formatDateTime(now)}</div>
        <button
          type="button"
          className="refresh-btn"
          onClick={handleRefreshClick}
          title="Reload cached data (cache-only — does not pull from source)"
          aria-label="Refresh cached data"
        >
          ⟳
        </button>
      </div>
    </header>
  );
}
