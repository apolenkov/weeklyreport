import type {
  LeadOpenWorkHistoryOccurrence,
  ReportSectionReadModel,
} from "@weeklyreport/shared";

import { formatPeriodRangeWithYear } from "../../../../../shared/lib/format/format-date";

type SectionItem = ReportSectionReadModel["items"][number];

type OpenWorkAction =
  | { readonly kind: "resume"; readonly label: "Resume paused work" }
  | { readonly kind: "continue"; readonly label: "Continue work" }
  | { readonly kind: "replan"; readonly label: "Replan deferred work" }
  | { readonly kind: "plan"; readonly label: "Plan this work" }
  | { readonly kind: "reopen"; readonly label: "Reopen in this report" };

export interface OpenWorkRegisterItem {
  readonly key: string;
  readonly occurrence: LeadOpenWorkHistoryOccurrence;
  readonly periodLabel: string;
  /**
   * System reason for work the rollover paused automatically. Projection
   * only: the stored occurrence keeps its original status tuple.
   */
  readonly automaticPauseReason?: string | null;
  readonly action: OpenWorkAction;
}

export interface OpenWorkRegisterModel {
  readonly openItems: readonly OpenWorkRegisterItem[];
  readonly terminalItems: readonly OpenWorkRegisterItem[];
}

function actionFor(
  item: LeadOpenWorkHistoryOccurrence["item"],
): OpenWorkAction {
  switch (item.workflowStatus) {
    case "paused":
      return { kind: "resume", label: "Resume paused work" };
    case "postponed":
      return { kind: "replan", label: "Replan deferred work" };
    case "planned":
      return { kind: "plan", label: "Plan this work" };
    case "in_progress":
      return { kind: "continue", label: "Continue work" };
    case "done":
      throw new Error(
        "Terminal work cannot be projected into the open register.",
      );
  }
}

function isTerminal(item: LeadOpenWorkHistoryOccurrence["item"]): boolean {
  return item.workflowStatus === "done" || item.resolution != null;
}

const AUTOMATIC_PAUSE_REASON = "Not scheduled for the new week";

/**
 * A Current planned item with no explicit next-period commitment does not
 * become active work on rollover; the register shows it as paused instead.
 */
function isAutomaticallyPaused(
  item: LeadOpenWorkHistoryOccurrence["item"],
): boolean {
  return (
    item.type === "current" &&
    item.workflowStatus === "planned" &&
    !item.nextStepText?.trim()
  );
}

function registerItem(
  occurrence: LeadOpenWorkHistoryOccurrence,
  action: OpenWorkAction,
  automaticPauseReason: string | null = null,
): OpenWorkRegisterItem {
  return {
    key: occurrence.item.stableId,
    occurrence,
    periodLabel: formatPeriodRangeWithYear(
      occurrence.periodStart,
      occurrence.periodEnd,
    ),
    automaticPauseReason,
    action,
  };
}

/**
 * Reduces newest-first history into one authoritative open occurrence per task.
 * Seeing a task marks its lineage as decided even when that occurrence is
 * terminal, so an older open state can never resurrect completed/cancelled work.
 */
export function projectOpenWorkRegister(
  occurrences: readonly LeadOpenWorkHistoryOccurrence[],
  currentItems: readonly Pick<SectionItem, "stableId">[],
): OpenWorkRegisterModel {
  const decided = new Set(
    currentItems.flatMap((item) => (item.stableId ? [item.stableId] : [])),
  );
  const open: OpenWorkRegisterItem[] = [];
  const terminal: OpenWorkRegisterItem[] = [];

  for (const occurrence of occurrences) {
    const stableId = occurrence.item.stableId;
    if (decided.has(stableId)) continue;
    decided.add(stableId);
    if (isTerminal(occurrence.item)) {
      terminal.push(
        registerItem(occurrence, {
          kind: "reopen",
          label: "Reopen in this report",
        }),
      );
      continue;
    }
    if (isAutomaticallyPaused(occurrence.item)) {
      open.push(
        registerItem(
          occurrence,
          { kind: "resume", label: "Resume paused work" },
          AUTOMATIC_PAUSE_REASON,
        ),
      );
      continue;
    }
    open.push(registerItem(occurrence, actionFor(occurrence.item)));
  }

  return { openItems: open, terminalItems: terminal };
}

export function openWorkOutsideTimeline(
  items: readonly OpenWorkRegisterItem[],
  timelineItems: readonly { readonly stableId: string | null }[],
): readonly OpenWorkRegisterItem[] {
  const visible = new Set(timelineItems.map((item) => item.stableId));
  return items.filter((item) => !visible.has(item.occurrence.item.stableId));
}

export function openWorkDisabledReason(
  canEdit: boolean,
  pendingInput: boolean,
  outcomeBlockedReason: string | null,
): string | null {
  if (!canEdit) return "Open an editable report to resume or replan this work.";
  if (pendingInput)
    return "Save or cancel the open input before starting another action.";
  return outcomeBlockedReason;
}
