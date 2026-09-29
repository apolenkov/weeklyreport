import {
  Check,
  ChevronsRight,
  Circle,
  CircleDot,
  CirclePause,
} from "lucide-react";

import type { ChipChoice } from "../../../shared/ui/forms/choice-chip-row";
import { NOT_STARTED_LABEL, STATUS_BADGE } from "../model/item-card-style";
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
    label: STATUS_BADGE.planned.label,
    icon: Circle,
    bg: CSS_MUTED,
    color: CSS_MUTED_FG,
    border: CHIP_IDLE_BORDER,
  },
  {
    value: IN_PROGRESS_STATUS,
    label: STATUS_BADGE["in-progress"].label,
    icon: CircleDot,
    bg: "var(--color-success)",
    color: CSS_PRIMARY,
    border: "var(--color-starbucks-accent)",
  },
  {
    value: "paused",
    label: STATUS_BADGE.paused.label,
    icon: CirclePause,
    bg: CSS_MUTED,
    color: CSS_MUTED_FG,
    border: CHIP_IDLE_BORDER,
  },
  {
    value: "postponed",
    label: STATUS_BADGE.postponed.label,
    icon: ChevronsRight,
    bg: CSS_MUTED,
    color: CSS_MUTED_FG,
    border: CHIP_IDLE_BORDER,
  },
  {
    value: "completed",
    label: STATUS_BADGE.completed.label,
    icon: Check,
    bg: CSS_PRIMARY,
    color: "var(--color-primary-foreground)",
    border: CSS_PRIMARY,
  },
];

// The current week reads "Not started" for an item that was never begun.
export function choicesForWeek(
  week: "current" | "next",
): readonly ChipChoice<ItemProgressStatus>[] {
  return week === "current"
    ? ITEM_STATUS_CHOICES.map((choice) =>
        choice.value === "planned"
          ? { ...choice, label: NOT_STARTED_LABEL }
          : choice,
      )
    : ITEM_STATUS_CHOICES;
}
