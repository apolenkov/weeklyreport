import type { ChipChoice } from "../../../shared/ui/choice-chip-row";
import type { ItemStatus } from "../model/types";

const CSS_PRIMARY = "var(--color-primary)";
export const IN_PROGRESS_STATUS = "in-progress";
// Shared quiet-chip palette for the not-in-flight states.
const CSS_MUTED = "var(--color-muted)";
const CSS_MUTED_FG = "var(--color-muted-foreground)";
const CHIP_IDLE_BORDER = "rgba(0,0,0,0.15)";

// record-status-derived-from-risk: no free "Blocked" chip and no in-dialog
// blocker gesture. An item's blocked / at-risk alarm is DERIVED from a
// covering risk, never a free item status — a blocker is created in Risks &
// Blockers (or the quick-add "Blocker" entry). Each item type authors only
// its own progress vocabulary (rework-item-status-model).
export const CURRENT_WEEK_CHOICES: readonly ChipChoice<ItemStatus>[] = [
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
    value: "completed",
    label: "✓ Completed",
    bg: CSS_PRIMARY,
    color: "#fff",
    border: CSS_PRIMARY,
  },
];

export const NEXT_WEEK_CHOICES: readonly ChipChoice<ItemStatus>[] = [
  {
    value: "planned",
    label: "○ Planned",
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
];
