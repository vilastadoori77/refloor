import { useMemo, useState } from 'react';
import type { ConsolidatedItem } from '@inventory/shared';
import { formatQty, formatSqft } from '../format';
import { AvailabilityCell } from './AvailabilityCell';

// Reusable consolidated-inventory grid. Two modes:
//   - 'grouped' → Satellite screen: grouped by Item Category with collapsible
//                 group headers (WEB-022/023). Columns: Item, On Hand, Allocated,
//                 Available, Available (ft²), Ordered.
//   - 'flat'    → Inventory Status shortage board (WEB-060): prepends a Satellite
//                 column and appends a status column.
// Available & Available (ft²) cells are colored by row.status (WEB-024).

type NumKey = 'onHand' | 'allocated' | 'available' | 'availableSqft' | 'ordered';

interface Props {
  items: ConsolidatedItem[];
  mode: 'grouped' | 'flat';
}

const STATUS_LABEL: Record<string, string> = {
  green: 'OK',
  yellow: 'Attention',
  red: 'Short',
};

export function InventoryGrid({ items, mode }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<NumKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const flat = mode === 'flat';

  // Column count for group-header colSpan.
  const colCount = flat ? 8 : 6;

  function toggleSort(key: NumKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sortedItems = useMemo(() => {
    if (!sortKey) return items;
    const arr = [...items];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [items, sortKey, sortDir]);

  // Grouped mode: bucket by itemCategoryCode, preserving first-seen order.
  const groups = useMemo(() => {
    if (flat) return null;
    const map = new Map<string, ConsolidatedItem[]>();
    for (const it of sortedItems) {
      const key = it.itemCategoryCode || 'OTHER';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return map;
  }, [sortedItems, flat]);

  function toggleGroup(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const NumHeader = ({ label, k }: { label: string; k: NumKey }) => (
    <th className="num sortable" onClick={() => toggleSort(k)}>
      {label}
      {sortKey === k && <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );

  const ItemCells = ({ it }: { it: ConsolidatedItem }) => (
    <>
      <td className="num">{formatQty(it.onHand)}</td>
      <td className="num">{formatQty(it.allocated)}</td>
      <AvailabilityCell value={formatQty(it.available)} status={it.status} />
      <AvailabilityCell value={formatSqft(it.availableSqft)} status={it.status} />
      <td className="num">{formatQty(it.ordered)}</td>
    </>
  );

  const ItemLabel = ({ it }: { it: ConsolidatedItem }) => (
    <td>
      <div>{it.description}</div>
      <div style={{ color: 'var(--text-faint)', fontSize: 11 }}>{it.itemNo}</div>
    </td>
  );

  if (items.length === 0) {
    return <div className="empty-state">No inventory items match the current filters.</div>;
  }

  return (
    <div className="grid-wrap">
      <table className="grid">
        <thead>
          <tr>
            {flat && <th>Satellite</th>}
            <th>Item</th>
            <NumHeader label="On Hand" k="onHand" />
            <NumHeader label="Allocated" k="allocated" />
            <NumHeader label="Available" k="available" />
            <NumHeader label="Available (ft²)" k="availableSqft" />
            <NumHeader label="Ordered" k="ordered" />
            {flat && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {flat
            ? sortedItems.map((it) => (
                <tr key={`${it.itemNo}-${it.locationCode}`}>
                  <td>{it.locationName || it.locationCode}</td>
                  <ItemLabel it={it} />
                  <td className="num">{formatQty(it.onHand)}</td>
                  <td className="num">{formatQty(it.allocated)}</td>
                  <AvailabilityCell value={formatQty(it.available)} status={it.status} />
                  <AvailabilityCell value={formatSqft(it.availableSqft)} status={it.status} />
                  <td className="num">{formatQty(it.ordered)}</td>
                  <td>{STATUS_LABEL[it.status] ?? it.status}</td>
                </tr>
              ))
            : [...groups!.entries()].map(([cat, rows]) => {
                const isCollapsed = collapsed.has(cat);
                return (
                  <GroupBlock
                    key={cat}
                    cat={cat}
                    rows={rows}
                    colCount={colCount}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleGroup(cat)}
                    renderRow={(it) => (
                      <tr key={`${it.itemNo}-${it.locationCode}`}>
                        <ItemLabel it={it} />
                        <ItemCells it={it} />
                      </tr>
                    )}
                  />
                );
              })}
        </tbody>
      </table>
    </div>
  );
}

function GroupBlock({
  cat,
  rows,
  colCount,
  isCollapsed,
  onToggle,
  renderRow,
}: {
  cat: string;
  rows: ConsolidatedItem[];
  colCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  renderRow: (it: ConsolidatedItem) => React.ReactNode;
}) {
  return (
    <>
      <tr className="group-header" onClick={onToggle}>
        <td colSpan={colCount}>
          <span className="caret">{isCollapsed ? '▸' : '▾'}</span>
          {cat} <span style={{ opacity: 0.7 }}>({rows.length})</span>
        </td>
      </tr>
      {!isCollapsed && rows.map(renderRow)}
    </>
  );
}
