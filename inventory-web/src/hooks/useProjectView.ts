import { useEffect, useState } from 'react';
import type { ProjectView } from '@inventory/shared';
import { ApiError, getProject } from '../api';

// Fetches GET /api/projects/:projectNo (SVC-042 / WEB-040…050). Re-runs when the
// selection changes or the cache-only reload counter changes (WEB-006). The
// endpoint may return 503 (snapshot not ready) — that is surfaced as a graceful
// error state, never a crash (WEB-050 handling requirement).
export function useProjectView(
  projectNo: string | null,
  reload: number,
  setRefreshedAt: (iso: string) => void,
) {
  const [view, setView] = useState<ProjectView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectNo) {
      setView(null);
      setError(null);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    getProject(projectNo, ac.signal)
      .then((env) => {
        setView(env.data);
        setRefreshedAt(env.refreshedAt);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === 'AbortError') return;
        setView(null);
        if (e instanceof ApiError && e.status === 503) {
          setError('The inventory snapshot is not ready yet (service returned 503). Try again shortly.');
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load project');
        }
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [projectNo, reload, setRefreshedAt]);

  return { view, loading, error };
}
