import type { Status } from '@inventory/shared';

// Colored status dot for the Project sidebar Inventory Status panel (WEB-041).
export function StatusDot({ status }: { status: Status }) {
  return <span className={`status-dot ${status}`} aria-hidden="true" />;
}
