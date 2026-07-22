import type { ItemStatus } from '@inventory/shared';

// Project table Item Status icon (WEB-047, ASM-003):
//   ready → green check, attention → yellow warning, short → red short marker.
const GLYPH: Record<ItemStatus, string> = {
  ready: '✓', // ✓
  attention: '⚠', // ⚠
  short: '✕', // ✕
};

const LABEL: Record<ItemStatus, string> = {
  ready: 'Ready',
  attention: 'Attention (covered by PO)',
  short: 'Short',
};

export function ItemStatusIcon({ status }: { status: ItemStatus }) {
  return (
    <span className={`item-status-icon ${status}`} title={LABEL[status]} role="img" aria-label={LABEL[status]}>
      {GLYPH[status]}
    </span>
  );
}
