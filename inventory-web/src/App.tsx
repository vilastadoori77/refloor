import { useCallback, useState } from 'react';
import { AuthGate, useDevUser } from './auth';
import { Header } from './components/Header';
import { InventoryFilters, EMPTY_FILTERS } from './components/InventoryFilters';
import type { Filters } from './components/InventoryFilters';
import { Sidebar } from './components/Sidebar';
import type { NavKey } from './components/NavMenu';
import { SatellitePage } from './pages/SatellitePage';
import { ProjectMain, ProjectSidebar } from './pages/ProjectPage';
import { StatusPage } from './pages/StatusPage';
import { useProjectView } from './hooks/useProjectView';

// Root shell (WEB-001/002): auth gate → header + sidebar (nav + page context
// panel) + active page. Holds the cross-cutting state: the shared "Last Updated"
// refreshedAt, the cache-only `reload` counter (WEB-006), active nav, per-page
// filters, and the selected project.
export function App() {
  const [user, signIn] = useDevUser();

  const [active, setActive] = useState<NavKey>('satellites');
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  // Cache-only reload counter (WEB-006). Bumped by the header refresh icon;
  // pages depend on it to re-read /api/*. It never triggers a source pull.
  const [reload, setReload] = useState(0);
  const bumpReload = useCallback(() => setReload((n) => n + 1), []);

  const [satFilters, setSatFilters] = useState<Filters>(EMPTY_FILTERS);
  const [statusFilters, setStatusFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Project data is shared by the sidebar (status dots + header fields) and the
  // main tables, so it is fetched once here.
  const project = useProjectView(selectedProject, reload, setRefreshedAt);

  const contextPanel = (() => {
    switch (active) {
      case 'satellites':
        return <InventoryFilters value={satFilters} onChange={setSatFilters} />;
      case 'projects':
        return (
          <ProjectSidebar
            selected={selectedProject}
            onSelect={setSelectedProject}
            view={project.view}
          />
        );
      case 'status':
        return (
          <InventoryFilters
            title="Shortage Filters"
            value={statusFilters}
            onChange={setStatusFilters}
          />
        );
    }
  })();

  const mainContent = (() => {
    switch (active) {
      case 'satellites':
        return (
          <SatellitePage filters={satFilters} reload={reload} setRefreshedAt={setRefreshedAt} />
        );
      case 'projects':
        return (
          <ProjectMain
            view={project.view}
            loading={project.loading}
            error={project.error}
            selected={selectedProject}
          />
        );
      case 'status':
        return (
          <StatusPage filters={statusFilters} reload={reload} setRefreshedAt={setRefreshedAt} />
        );
    }
  })();

  return (
    <AuthGate user={user} onSignIn={signIn}>
      <div className="app-shell">
        <Header
          refreshedAt={refreshedAt}
          setRefreshedAt={setRefreshedAt}
          onRefresh={bumpReload}
        />
        <Sidebar active={active} onNavigate={setActive}>
          {contextPanel}
        </Sidebar>
        <main className="app-main">{mainContent}</main>
      </div>
    </AuthGate>
  );
}
