import type { StatusOverviewItem } from "./status-overview";
type SecondaryAction = "edit" | "move";
type RecoveryAction = "replan" | "restore";

export interface StatusOverviewActionModel {
  /** The status menu on the icon; absent on read-only, terminal and derived items. */
  readonly primary: "status" | null;
  /** Entries of the quiet overflow disclosure, in display order. */
  readonly secondary: readonly SecondaryAction[];
  /** Conditional standalone actions: historical replan, restore. */
  readonly recovery: readonly RecoveryAction[];
}

function primaryActionFor(
  item: StatusOverviewItem,
  editable: boolean,
): StatusOverviewActionModel["primary"] {
  // The linked Next projection renders the Current record's status, so the
  // status is changed on the Current item, never from the projection.
  return editable && item.editTarget?.focusNextStep !== true ? "status" : null;
}

function secondaryActionsFor(
  item: StatusOverviewItem,
  editable: boolean,
): SecondaryAction[] {
  const target = item.editTarget;
  if (!editable || target === null || item.resolution != null) return [];
  const actions: SecondaryAction[] = [];
  if (target.focusNextStep !== true) actions.push("edit");
  if (item.workflowStatus !== "done") actions.push("move");
  return actions;
}

function recoveryActionsFor(item: StatusOverviewItem): RecoveryAction[] {
  const actions: RecoveryAction[] = [];
  // A pending verdict is answered on the rail: one verdict per action, so the
  // replan icon would offer a second way to answer the same row.
  if (
    item.source === "previous" &&
    item.canResolve &&
    item.workflowStatus !== "done" &&
    item.verdict !== "pending"
  )
    actions.push("replan");
  if (item.canRestore) actions.push("restore");
  return actions;
}

/**
 * One primary status interaction for editable active items, Edit and week
 * movement inside one secondary overflow, and conditional recovery actions.
 * Previous stays informational; choosing a status also confirms a carried
 * item, so there is no separate confirm action.
 */
export function statusOverviewItemActions(
  item: StatusOverviewItem,
): StatusOverviewActionModel {
  const editable = item.source !== "previous" && item.editTarget !== null;
  return {
    primary: primaryActionFor(item, editable),
    secondary: secondaryActionsFor(item, editable),
    recovery: recoveryActionsFor(item),
  };
}
