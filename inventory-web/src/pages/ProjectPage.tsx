import { useEffect, useState } from 'react';
import type {
  ProjectItemRow,
  ProjectTotals,
  ProjectView,
  SaleHeader,
} from '@inventory/shared';
import { getProjects } from '../api';
import { AvailabilityCell } from '../components/AvailabilityCell';
import { ItemStatusIcon } from '../components/ItemStatusIcon';
import { StatusDot } from '../components/StatusDot';
import { formatAmount } from '../format';

const FLOORING_CAPTION =
  'Unless approved by a Project Coordination Manager, please do not schedule this project if a green check box is not present on all listed flooring items.';
const ADDITIONAL_CAPTION =
  'Please ensure missing materials will be delivered prior to the Installation Completion Date so as not to impact the installation time frame.';

// ─────────────────────────────── Sidebar ────────────────────────────────

// Project screen sidebar (WEB-040/041/042): Sale Selection panel with read-only
// header fields, the Inventory Status panel (status dots), and the gold warning
// callout when materials are not ready.
export function ProjectSidebar({
  selected,
  onSelect,
  view,
}: {
  selected: string | null;
  onSelect: (projectNo: string) => void;
  view: ProjectView | null;
}) {
  const [projects, setProjects] = useState<SaleHeader[]>([]);

  useEffect(() => {
    const ac = new AbortController();
    getProjects(ac.signal)
      .then((env) => {
        setProjects(env.data);
        // Auto-select the first project so the screen is populated on entry.
        if (!selected && env.data.length > 0) onSelect(env.data[0].projectNo);
      })
      .catch(() => {
        /* project list unavailable — dropdown stays empty */
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = view?.header ?? null;
  const flooringReady = view?.status.flooringReady ?? true;
  const additionalReady = view?.status.additionalReady ?? true;

  return (
    <>
      <div className="panel">
        <h3 className="panel-title">Sale Selection</h3>
        <div className="field">
          <label htmlFor="proj-select">Project</label>
          {/* WEB-050: native select supports type-ahead by Sale/customer text. */}
          <select
            id="proj-select"
            value={selected ?? ''}
            onChange={(e) => onSelect(e.target.value)}
          >
            {!selected && <option value="">Select a project…</option>}
            {projects.map((p) => (
              <option key={p.projectNo} value={p.projectNo}>
                {p.saleNo} — {p.customer} ({p.satelliteName})
              </option>
            ))}
          </select>
        </div>

        <ReadOnly label="Sale #" value={header?.saleNo} />
        <ReadOnly label="Satellite" value={header?.satelliteName} />
        <ReadOnly label="Customer" value={header?.customer} />
        <ReadOnly label="BC Status" value={header?.bcStatus} />
        <ReadOnly label="File Status" value={header?.fileStatus} />
        <ReadOnly label="Install Date" value={header?.installDate} installDate />
      </div>

      <div className="panel">
        <h3 className="panel-title">Inventory Status</h3>
        <div className="status-row">
          <span>
            <StatusDot status={flooringReady ? 'green' : 'yellow'} />
            Flooring Materials
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {flooringReady ? 'Ready' : 'Attention'}
          </span>
        </div>
        <div className="status-row">
          <span>
            <StatusDot status={additionalReady ? 'green' : 'yellow'} />
            Additional Materials
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {additionalReady ? 'Ready' : 'Attention'}
          </span>
        </div>
      </div>

      {/* WEB-042 — gold callout, hidden when everything is green. */}
      {view && !additionalReady && (
        <div className="callout-warning">
          <span className="icon">⚠</span>
          <span>Additional materials are not available. Verify delivery before proceeding.</span>
        </div>
      )}
      {view && !flooringReady && (
        <div className="callout-warning">
          <span className="icon">⚠</span>
          <span>Flooring materials are short. Do not schedule without Project Coordination Manager approval.</span>
        </div>
      )}
    </>
  );
}

function ReadOnly({
  label,
  value,
  installDate,
}: {
  label: string;
  value?: string | null;
  installDate?: boolean;
}) {
  return (
    <div className={`field readonly-field${installDate ? ' install-date' : ''}`}>
      <label>{label}</label>
      <div className="value">{value ?? '—'}</div>
    </div>
  );
}

// ──────────────────────────────── Main ──────────────────────────────────

// Project screen main content (WEB-043…049): two captioned tables with totals.
export function ProjectMain({
  view,
  loading,
  error,
  selected,
}: {
  view: ProjectView | null;
  loading: boolean;
  error: string | null;
  selected: string | null;
}) {
  if (!selected) {
    return <div className="empty-state">Select a project to view its material readiness.</div>;
  }
  if (error) {
    return <div className="banner-error">{error}</div>;
  }
  if (loading && !view) {
    return <div className="loading-note">Loading project…</div>;
  }
  if (!view) {
    return <div className="empty-state">No project data available.</div>;
  }

  return (
    <div>
      <ProjectTable
        title="Flooring"
        caption={FLOORING_CAPTION}
        rows={view.flooring}
        totals={view.totals.flooring}
      />
      <ProjectTable
        title="Additional Materials"
        caption={ADDITIONAL_CAPTION}
        rows={view.additional}
        totals={view.totals.additional}
      />
    </div>
  );
}

function ProjectTable({
  title,
  caption,
  rows,
  totals,
}: {
  title: string;
  caption: string;
  rows: ProjectItemRow[];
  totals: ProjectTotals;
}) {
  return (
    <div className="section-block">
      <h2 className="page-title" style={{ fontSize: 18 }}>
        {title}
      </h2>
      <p className="page-caption">{caption}</p>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Product</th>
              <th>Item Category</th>
              <th className="num">Required</th>
              <th className="num">Available</th>
              <th className="num">Ordered</th>
              <th className="num">Picked</th>
              <th className="num">Remainder</th>
              <th>Item Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No items in this section.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.product}-${i}`}>
                  <td>{r.product}</td>
                  <td>{r.itemCategory}</td>
                  <td className="num">{formatAmount(r.required)}</td>
                  {/* WEB-046: Available green when ≥ required, red when short. */}
                  <AvailabilityCell
                    value={formatAmount(r.available)}
                    status={r.available >= r.required ? 'green' : 'red'}
                  />
                  <td className="num">{formatAmount(r.ordered)}</td>
                  {/* WEB-049: Picked always renders 0.00. */}
                  <td className="num">{formatAmount(r.picked)}</td>
                  <td className={`num${r.remainder > 0 ? ' remainder-short' : ''}`}>
                    {formatAmount(r.remainder)}
                  </td>
                  <td>
                    <ItemStatusIcon status={r.itemStatus} />
                  </td>
                </tr>
              ))
            )}
            {/* WEB-048: Total row (bold sums). */}
            <tr className="total-row">
              <td>Total</td>
              <td />
              <td className="num">{formatAmount(totals.required)}</td>
              <td className="num">{formatAmount(totals.available)}</td>
              <td className="num">{formatAmount(totals.ordered)}</td>
              <td className="num">{formatAmount(totals.picked)}</td>
              <td className="num">{formatAmount(totals.remainder)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
