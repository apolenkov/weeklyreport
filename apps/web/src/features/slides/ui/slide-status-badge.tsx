import type { CanonicalStatus } from "@customreport/shared";

import {
  statusIcon,
  statusLabel,
  type StatusLabelVariant,
  statusToneClassName,
} from "../../../lib/status-presentation";

// No pre-formatted tone prop — callers must go through the canonical map.
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
      {/* eslint-disable-next-line react-hooks/static-components -- statusIcon is a pure lookup returning a module-constant Lucide component, not a component created during render */}
      {Icon !== null && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
      {statusLabel(status, labelVariant)}
    </span>
  );
}
