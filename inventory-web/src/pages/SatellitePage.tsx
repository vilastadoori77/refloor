import type { Filters } from '../components/InventoryFilters';
import { InventoryGrid } from '../components/InventoryGrid';
import { useInventory } from '../hooks/useInventory';

// Satellite screen main content (WEB-020…030). The "Inventory Filters" sidebar
// panel is rendered by App; this component owns the "All Inventory Items" grid,
// grouped by Item Category with colored availability cells.
export function SatellitePage({
  filters,
  reload,
  setRefreshedAt,
}: {
  filters: Filters;
  reload: number;
  setRefreshedAt: (iso: string) => void;
}) {
  const { items, loading, error } = useInventory(filters, reload, setRefreshedAt);

  return (
    <div>
      <h1 className="page-title">All Inventory Items</h1>
      <p className="page-caption">
        Consolidated on-hand, allocation and availability across the selected satellite.
      </p>

      {error && <div className="banner-error">Failed to load inventory: {error}</div>}
      {loading && items.length === 0 ? (
        <div className="loading-note">Loading inventory…</div>
      ) : (
        <InventoryGrid items={items} mode="grouped" />
      )}
    </div>
  );
}
