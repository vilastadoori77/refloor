// Left-rail navigation (WEB-007). Entries: Satellites, Projects,
// Item Details (visible but disabled/greyed per ASM-006), Inventory Status.
// Active entry highlighted with the blue accent.

export type NavKey = 'satellites' | 'projects' | 'status';

interface NavDef {
  key: NavKey | 'itemDetails';
  label: string;
  icon: string;
  disabled?: boolean;
}

const ENTRIES: NavDef[] = [
  { key: 'satellites', label: 'Satellites', icon: '▦' },
  { key: 'projects', label: 'Projects', icon: '▤' },
  { key: 'itemDetails', label: 'Item Details', icon: '▣', disabled: true },
  { key: 'status', label: 'Inventory Status', icon: '◆' },
];

export function NavMenu({
  active,
  onNavigate,
}: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
}) {
  return (
    <nav className="nav-menu" aria-label="Primary">
      {ENTRIES.map((e) => {
        const isActive = !e.disabled && e.key === active;
        return (
          <button
            key={e.key}
            type="button"
            className={`nav-item${isActive ? ' active' : ''}`}
            disabled={e.disabled}
            aria-current={isActive ? 'page' : undefined}
            title={e.disabled ? 'Item Details — coming soon (disabled)' : undefined}
            onClick={() => {
              if (!e.disabled) onNavigate(e.key as NavKey);
            }}
          >
            <span className="nav-icon" aria-hidden="true">
              {e.icon}
            </span>
            {e.label}
          </button>
        );
      })}
    </nav>
  );
}
