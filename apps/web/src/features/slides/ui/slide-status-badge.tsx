import type { CanonicalStatus } from "@customreport/shared";
import { createElement } from "react";

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
      {Icon !== null &&
        createElement(Icon, { "aria-hidden": true, className: "h-3.5 w-3.5" })}
      {statusLabel(status, labelVariant)}
    </span>
  );
}
