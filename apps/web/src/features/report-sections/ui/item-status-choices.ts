import type { ChipChoice } from "../../../shared/ui/forms/choice-chip-row";
import type { ItemProgressStatus } from "../model/types";

const CSS_PRIMARY = "var(--color-primary)";
export const IN_PROGRESS_STATUS = "in-progress";
// Shared quiet-chip palette for the not-in-flight states.
const CSS_MUTED = "var(--color-muted)";
const CSS_MUTED_FG = "var(--color-muted-foreground)";
const CHIP_IDLE_BORDER = "var(--color-border-strong)";

// Week placement does not restrict progress; alarms derive from covering risks.
export const ITEM_STATUS_CHOICES: readonly ChipChoice<ItemProgressStatus>[] = [
  {
    value: "planned",
    label: "○ Planned",
    bg: CSS_MUTED,
    color: CSS_MUTED_FG,
    border: CHIP_IDLE_BORDER,
  },
  {
    value: IN_PROGRESS_STATUS,
    label: "! In Progress",
    bg: "var(--color-success)",
    color: CSS_PRIMARY,
    border: "var(--color-starbucks-accent)",
  },
  {
    value: "paused",
    label: "‖ Paused",
    bg: CSS_MUTED,
    color: CSS_MUTED_FG,
    border: CHIP_IDLE_BORDER,
  },
  {
    value: "postponed",
    label: "» Postponed",
    bg: CSS_MUTED,
    color: CSS_MUTED_FG,
    border: CHIP_IDLE_BORDER,
  },
  {
    value: "completed",
    label: "✓ Completed",
    bg: CSS_PRIMARY,
    color: "var(--color-primary-foreground)",
    border: CSS_PRIMARY,
  },
];
