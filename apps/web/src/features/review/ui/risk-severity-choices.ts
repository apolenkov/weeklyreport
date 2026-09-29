import { CircleAlert, OctagonX } from "lucide-react";

import type { ChipChoice } from "../../../shared/ui/forms/choice-chip-row";
import { STATUS_BADGE } from "../../report-sections";
import type { RiskSeverity } from "./risk-edit-dialog-helpers";

export const SEVERITY_CHOICES: readonly ChipChoice<RiskSeverity>[] = [
  {
    value: "at-risk",
    label: STATUS_BADGE["at-risk"].label,
    icon: CircleAlert,
    bg: "var(--color-status-at-risk-bg)",
    color: "var(--color-status-at-risk-fg)",
    // Match the at-risk status accent used by the severity indicator.
    border: "var(--color-status-dot-at-risk)",
  },
  {
    value: "blocked",
    label: STATUS_BADGE.blocked.label,
    icon: OctagonX,
    bg: "var(--color-status-blocked-bg)",
    color: "var(--color-destructive)",
    border: "var(--color-destructive)",
  },
];
