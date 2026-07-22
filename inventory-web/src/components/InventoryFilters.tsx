import { useEffect, useState } from 'react';
import type { LocationOption } from '@inventory/shared';
import { getCategories, getLocations } from '../api';

// Sidebar "Inventory Filters" panel (WEB-020/026/027). Shared by the Satellite
// screen and the Inventory Status shortage board. Filter values live in the
// parent (App) so the sidebar panel and the main grid stay in sync; changing a
// value triggers a server-side re-fetch of /api/inventory in the page.

export interface Filters {
  location: string; // 'All' or a location code
  category: string; // 'All' or a category code
  search: string; // free text, '' = All
}

export const EMPTY_FILTERS: Filters = { location: 'All', category: 'All', search: '' };

export function InventoryFilters({
  title = 'Inventory Filters',
  value,
  onChange,
}: {
  title?: string;
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Options are static reference data — fetched once via /api only (WEB-003).
  useEffect(() => {
    const ac = new AbortController();
    getLocations(ac.signal)
      .then((env) => setLocations(env.data))
      .catch(() => {
        /* options unavailable — dropdown falls back to just "All" */
      });
    getCategories(ac.signal)
      .then((env) => setCategories(env.data))
      .catch(() => {
        /* ignore */
      });
    return () => ac.abort();
  }, []);

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>

      <div className="field">
        <label htmlFor="flt-satellite">Satellite</label>
        <select
          id="flt-satellite"
          value={value.location}
          onChange={(e) => set({ location: e.target.value })}
        >
          <option value="All">All</option>
          {locations.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="flt-category">Item Category</label>
        <select
          id="flt-category"
          value={value.category}
          onChange={(e) => set({ category: e.target.value })}
        >
          <option value="All">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="flt-search">Item (search)</label>
        <input
          id="flt-search"
          type="text"
          placeholder="All"
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
        />
      </div>

      <button
        type="button"
        className="btn btn-block"
        onClick={() => onChange(EMPTY_FILTERS)}
      >
        Clear filters
      </button>
    </div>
  );
}
