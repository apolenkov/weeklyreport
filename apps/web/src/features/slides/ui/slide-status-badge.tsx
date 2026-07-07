import {
  type CanonicalStatus,
  statusIcon,
  statusLabel,
  type StatusLabelVariant,
  statusToneClassName,
} from "../../../lib/status-presentation";

/**
 * The shared worst-status pill: a canonical status plus its label variant in,
 * label + icon + tone resolved from the canonical map. No pre-formatted
 * tone/color prop, so a caller cannot bypass the map and re-introduce drift.
 */
export function SlideStatusBadge({
  status,
  labelVariant,
}: {
  readonly status: CanonicalStatus;
  readonly labelVariant: StatusLabelVariant;
}) {
  const Icon = statusIcon(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-semibold ${statusToneClassName(status)}`}
    >
      {Icon !== null && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
      {statusLabel(status, labelVariant)}
    </span>
  );
}
