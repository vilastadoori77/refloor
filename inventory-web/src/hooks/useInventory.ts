import { useEffect, useState } from 'react';
import type { ConsolidatedItem } from '@inventory/shared';
import { getInventory } from '../api';
import type { Filters } from '../components/InventoryFilters';

// Fetches /api/inventory server-side for the given filters (WEB-026): re-runs
// whenever a filter changes AND whenever the cache-only reload counter changes
// (WEB-006). Every successful envelope refreshes the shared "Last Updated"
// value — a cache-only reload returns the same refreshedAt, so it never falsely
// advances (WEB-005/006).
export function useInventory(
  filters: Filters,
  reload: number,
  setRefreshedAt: (iso: string) => void,
) {
  const [items, setItems] = useState<ConsolidatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    getInventory(
      { location: filters.location, category: filters.category, search: filters.search },
      ac.signal,
    )
      .then((env) => {
        setItems(env.data);
        setRefreshedAt(env.refreshedAt);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load inventory');
        setItems([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [filters.location, filters.category, filters.search, reload, setRefreshedAt]);

  return { items, loading, error };
}
