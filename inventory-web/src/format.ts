// Number formatting helpers (WEB-013/025): thousands separators + fixed
// decimals, rendered with tabular numerals in the grids via CSS.

/**
 * Format a number with grouping separators and a fixed number of decimals.
 * decimals defaults to 0 (whole-unit quantity columns). Pass 2 for ft² and
 * project-table money-like columns.
 */
export function formatNumber(value: number, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Whole-unit quantity (On Hand, Allocated, Available, Ordered). */
export function formatQty(value: number): string {
  return formatNumber(value, 0);
}

/** Square-foot value — always 2 decimals (WEB-025). */
export function formatSqft(value: number): string {
  return formatNumber(value, 2);
}

/** Project-table numeric cell — 2 decimals to match Picked `0.00` (WEB-049). */
export function formatAmount(value: number): string {
  return formatNumber(value, 2);
}

/** Human-readable local date/time for the header clock (WEB-004). */
export function formatDateTime(d: Date): string {
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "Last Updated" rendering of an ISO timestamp, or a dash when unknown. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDateTime(d);
}
