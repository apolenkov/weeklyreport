import type { ChipChoice } from "../../../shared/ui/choice-chip-row";
import type { RiskSeverity } from "./risk-edit-dialog-helpers";

export const SEVERITY_CHOICES: readonly ChipChoice<RiskSeverity>[] = [
  {
    value: "at-risk",
    label: "! At Risk",
    bg: "var(--color-status-at-risk-bg)",
    color: "var(--color-status-at-risk-fg)",
    // border reuses the at-risk dot token (named for this #d4a017 gold accent);
    // the at-risk-border token is a different shade, an unsigned pixel shift.
    border: "var(--color-status-dot-at-risk)",
  },
  {
    value: "blocked",
    label: "✕ Blocked",
    bg: "var(--color-status-blocked-bg)",
    color: "var(--color-destructive)",
    border: "var(--color-destructive)",
  },
];
