import type { ReactNode } from 'react';
import { NavMenu } from './NavMenu';
import type { NavKey } from './NavMenu';

// Fixed left sidebar (WEB-002): persistent nav menu on top, plus the active
// page's context panel below (filters on Satellites; sale-selection +
// inventory-status on Projects; filters on Inventory Status).
export function Sidebar({
  active,
  onNavigate,
  children,
}: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  children?: ReactNode;
}) {
  return (
    <aside className="sidebar app-sidebar">
      <NavMenu active={active} onNavigate={onNavigate} />
      <div className="context-panel">{children}</div>
    </aside>
  );
}
