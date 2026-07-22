import type { Status } from '@inventory/shared';

// A numeric table cell whose background is conditionally colored by the row's
// status (WEB-024/046) — Power BI conditional-formatting look, dark text.
export function AvailabilityCell({
  value,
  status,
}: {
  value: string;
  status: Status;
}) {
  return <td className={`status-cell num ${status}`}>{value}</td>;
}
