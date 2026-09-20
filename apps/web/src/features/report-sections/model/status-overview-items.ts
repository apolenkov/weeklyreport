import type { ReportSectionReadModel } from "@customreport/shared";

import type {
  StatusOverviewItem,
  StatusOverviewProjectionSource,
  StatusOverviewSection,
  StatusOverviewUnit,
  StatusOverviewUnitKind,
} from "./status-overview";

type SectionItem = ReportSectionReadModel["items"][number];

export function statusOverviewItemParent(
  item: SectionItem,
): { kind: StatusOverviewUnitKind; id: string } | null {
  if (item.projectId != null) return { kind: "product", id: item.projectId };
  if (item.activityId != null) return { kind: "activity", id: item.activityId };
  return null;
}

export function hasStatusOverviewParent(item: SectionItem): boolean {
  return statusOverviewItemParent(item) !== null;
}

export function hasNextCommitment(item: SectionItem): boolean {
  return item.type === "next" || Boolean(item.nextStepText?.trim());
}

function stableIdentity(item: SectionItem): string | null {
  return item.stableId?.length ? item.stableId : null;
}

function priorContinuity(
  item: SectionItem,
  input: StatusOverviewProjectionSource,
  priorIds: ReadonlySet<string>,
): StatusOverviewItem["continuity"] {
  if (input.previousPlan.availability !== "available") return null;
  const stableId = stableIdentity(item);
  return stableId !== null && priorIds.has(stableId)
    ? "continued"
    : "unplanned";
}

function canResolvePlan(
  source: StatusOverviewItem["source"],
  stableId: string | null,
  recordId: string | null,
  resolution: SectionItem["resolution"],
  input: StatusOverviewProjectionSource,
  currentStableIds: ReadonlySet<string>,
): boolean {
  if (
    !input.currentItemsEditable ||
    stableId === null ||
    recordId === null ||
    resolution != null
  )
    return false;
  return source !== "previous" || !currentStableIds.has(stableId);
}

function canEditItem(
  source: StatusOverviewItem["source"],
  recordId: string | null,
  resolution: SectionItem["resolution"],
  input: StatusOverviewProjectionSource,
): boolean {
  return (
    input.currentItemsEditable &&
    recordId !== null &&
    source !== "previous" &&
    resolution == null
  );
}

function editTargetFor(
  item: SectionItem,
  source: StatusOverviewItem["source"],
  recordId: string | null,
  nextStep: string | null,
  resolution: SectionItem["resolution"],
  input: StatusOverviewProjectionSource,
): StatusOverviewItem["editTarget"] {
  if (recordId === null || !canEditItem(source, recordId, resolution, input))
    return null;
  return {
    recordId,
    source: item.type,
    ...(nextStep && source === "next" ? { focusNextStep: true } : {}),
  };
}

function overviewWorkflowStatus(
  item: SectionItem,
  nextStep: string | null,
): StatusOverviewItem["workflowStatus"] {
  return nextStep && item.workflowStatus !== "paused"
    ? "planned"
    : item.workflowStatus;
}

function canRestorePlan(
  source: StatusOverviewItem["source"],
  stableId: string | null,
  recordId: string | null,
  resolution: SectionItem["resolution"],
  input: StatusOverviewProjectionSource,
): boolean {
  return (
    input.currentItemsEditable &&
    source !== "previous" &&
    stableId !== null &&
    recordId !== null &&
    resolution != null
  );
}

function toOverviewItem(
  item: SectionItem,
  source: StatusOverviewItem["source"],
  index: number,
  input: StatusOverviewProjectionSource,
  priorIds: ReadonlySet<string>,
  currentStableIds: ReadonlySet<string>,
): StatusOverviewItem {
  const stableId = stableIdentity(item);
  const recordId = item.id ?? null;
  const resolution = item.resolution ?? null;
  const nextStep =
    source !== "current" && item.type === "current"
      ? (item.nextStepText ?? null)
      : null;
  return {
    key: `${source}:${stableId ?? item.id ?? String(index)}`,
    recordId,
    source,
    stableId,
    editTarget: editTargetFor(
      item,
      source,
      recordId,
      nextStep,
      resolution,
      input,
    ),
    text: nextStep ?? item.text,
    tag: item.tag,
    stageNames: item.stageNames,
    pausedReason: item.pausedReason ?? null,
    resolution,
    outcomeHistory: item.outcomeHistory ?? [],
    // Only the derived Next projection is a second rendering of the same
    // record's commitment; the Previous lane is that record's only projection,
    // so its comments stay.
    comments:
      source === "next" && nextStep !== null ? [] : (item.comments ?? []),
    canResolve: canResolvePlan(
      source,
      stableId,
      recordId,
      resolution,
      input,
      currentStableIds,
    ),
    canRestore: canRestorePlan(source, stableId, recordId, resolution, input),
    workflowStatus: overviewWorkflowStatus(item, nextStep),
    needsConfirmation:
      source === "current" && item.type === "current" && item.carriedOver,
    continuity:
      source === "current" ? priorContinuity(item, input, priorIds) : null,
  };
}

function isPreviousPlanItem(item: SectionItem): boolean {
  return hasNextCommitment(item) || item.resolution != null;
}

function itemsForUnit(
  items: readonly SectionItem[],
  source: "current" | "next",
  kind: StatusOverviewUnitKind,
  id: string,
): SectionItem[] {
  return items.filter((item) => {
    const parent = statusOverviewItemParent(item);
    const inColumn =
      source === "next" ? hasNextCommitment(item) : item.type === "current";
    return inColumn && parent?.kind === kind && parent.id === id;
  });
}

export function buildStatusOverviewColumns(
  kind: StatusOverviewUnitKind,
  id: string,
  input: StatusOverviewProjectionSource,
  previous: StatusOverviewSection | null,
): StatusOverviewUnit["columns"] {
  const priorIds = new Set(
    (previous?.items ?? [])
      .filter((item) => hasNextCommitment(item) && item.resolution == null)
      .flatMap((item) => {
        const stableId = stableIdentity(item);
        return stableId === null ? [] : [stableId];
      }),
  );
  const currentStableIds = new Set(
    input.currentSection.items.flatMap((item) => {
      const stableId = stableIdentity(item);
      return stableId === null ? [] : [stableId];
    }),
  );
  const project = (
    items: readonly SectionItem[],
    source: StatusOverviewItem["source"],
  ) =>
    items.map((item, index) =>
      toOverviewItem(item, source, index, input, priorIds, currentStableIds),
    );
  return {
    previouslyPlanned:
      input.previousPlan.availability === "available"
        ? {
            availability: "available",
            items: project(
              (previous?.items ?? []).filter((item) => {
                const parent = statusOverviewItemParent(item);
                return (
                  isPreviousPlanItem(item) &&
                  parent?.kind === kind &&
                  parent.id === id
                );
              }),
              "previous",
            ),
          }
        : {
            availability: "unavailable",
            reason: input.previousPlan.reason,
            items: [],
          },
    currentWeek: {
      availability: "available",
      items: project(
        itemsForUnit(input.currentSection.items, "current", kind, id),
        "current",
      ),
    },
    nextWeek: {
      availability: "available",
      items: project(
        itemsForUnit(input.currentSection.items, "next", kind, id),
        "next",
      ),
    },
  };
}

type SecondaryAction = "edit" | "move";
type RecoveryAction = "replan" | "restore";

export interface StatusOverviewActionModel {
  /** The single primary control; absent on read-only and terminal items. */
  readonly primary: "progress" | null;
  /** Entries of the quiet overflow disclosure, in display order. */
  readonly secondary: readonly SecondaryAction[];
  /** Conditional standalone actions: historical replan, restore. */
  readonly recovery: readonly RecoveryAction[];
}

function primaryActionFor(
  item: StatusOverviewItem,
  editable: boolean,
): StatusOverviewActionModel["primary"] {
  // A carried item keeps the primary even without an edit target: the
  // confirmation patch is the only path that clears carriedOver there.
  if (item.needsConfirmation === true && item.source === "current")
    return "progress";
  if (!editable) return null;
  if (item.canResolve && item.workflowStatus !== "done") return "progress";
  return null;
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
  if (
    item.source === "previous" &&
    item.canResolve &&
    item.workflowStatus !== "done"
  )
    actions.push("replan");
  if (item.canRestore) actions.push("restore");
  return actions;
}

/**
 * One primary progress interaction for editable active items, Edit and week
 * movement inside one secondary overflow, and conditional recovery actions.
 * Previous stays informational; an unconfirmed carried item keeps the same
 * primary so confirming goes through the canonical progress path.
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
