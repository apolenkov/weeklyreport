import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { itemStatusRiskText } from "./lead-actions/lead-item-status-patch";
import type {
  StatusOverviewItem,
  StatusOverviewProjectionSource,
  StatusOverviewSection,
  StatusOverviewUnit,
  StatusOverviewUnitKind,
} from "./status-overview";
import { compareIdentityOrder } from "./status-overview-item-order";
import { priorVerdictState } from "./status-overview-verdict";

type SectionItem = ReportSectionReadModel["items"][number];

export function statusOverviewItemParent(
  item: SectionItem,
): { kind: StatusOverviewUnitKind; id: string } | null {
  if (item.projectId != null) return { kind: "product", id: item.projectId };
  if (item.activityId != null) return { kind: "activity", id: item.activityId };
  return null;
}

function hasNextCommitment(item: SectionItem): boolean {
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

interface PlanFacts {
  readonly source: StatusOverviewItem["source"];
  readonly stableId: string | null;
  readonly recordId: string | null;
  readonly resolution: SectionItem["resolution"];
}

interface ItemProjectionContext {
  readonly historicalResult?: boolean;
  readonly input: StatusOverviewProjectionSource;
  readonly priorIds: ReadonlySet<string>;
  /** The selected week's record per `stableId`; Current wins over Next. */
  readonly currentByStableId: ReadonlyMap<string, SectionItem>;
}

function canResolvePlan(
  { source, stableId, recordId, resolution }: PlanFacts,
  input: StatusOverviewProjectionSource,
  currentStableIds: ReadonlyMap<string, SectionItem>,
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
  { source, recordId, resolution }: PlanFacts,
  nextStep: string | null,
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
  { source, stableId, recordId, resolution }: PlanFacts,
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

function verdictField(
  prior: SectionItem,
  linked: SectionItem | null,
): Pick<StatusOverviewItem, "verdict"> {
  const verdict = priorVerdictState(prior, linked, true);
  return verdict === null ? {} : { verdict };
}

function statusInputFields(
  item: SectionItem,
  source: StatusOverviewItem["source"],
  nextStep: string | null,
  input: StatusOverviewProjectionSource,
) {
  return {
    nextStepText: source === "current" ? (item.nextStepText ?? null) : null,
    statusRiskText:
      source === "previous" || nextStep !== null
        ? null
        : itemStatusRiskText(input.currentSection, item),
  };
}

function toOverviewItem(
  item: SectionItem,
  source: StatusOverviewItem["source"],
  index: number,
  {
    input,
    priorIds,
    currentByStableId,
    historicalResult,
  }: ItemProjectionContext,
): StatusOverviewItem {
  const stableId = stableIdentity(item);
  const recordId = item.id ?? null;
  const resolution = item.resolution ?? null;
  const facts = { source, stableId, recordId, resolution };
  const nextStep =
    !historicalResult && source !== "current" && item.type === "current"
      ? (item.nextStepText ?? null)
      : null;
  return {
    key: `${source}:${stableId ?? item.id ?? String(index)}`,
    recordId,
    source,
    stableId,
    editTarget: editTargetFor(item, facts, nextStep, input),
    text: nextStep ?? item.text,
    tag: item.tag,
    stageNames: item.stageNames,
    pausedReason: item.pausedReason ?? null,
    ...statusInputFields(item, source, nextStep, input),
    resolution,
    outcomeHistory: item.outcomeHistory ?? [],
    // A derived Next projection shares its record's one discussion; showing an
    // empty list there would claim the discussion has no messages.
    comments: item.comments ?? [],
    canResolve:
      !historicalResult && canResolvePlan(facts, input, currentByStableId),
    canRestore: canRestorePlan(facts, input),
    workflowStatus: overviewWorkflowStatus(item, nextStep),
    needsConfirmation:
      source === "current" && item.type === "current" && item.carriedOver,
    continuity:
      source === "current" ? priorContinuity(item, input, priorIds) : null,
    ...(!historicalResult && source === "previous" && stableId !== null
      ? verdictField(item, currentByStableId.get(stableId) ?? null)
      : {}),
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
  const currentByStableId = new Map<string, SectionItem>();
  for (const item of input.currentSection.items) {
    const stableId = stableIdentity(item);
    if (stableId === null) continue;
    const known = currentByStableId.get(stableId);
    if (
      known === undefined ||
      (known.type === "next" && item.type === "current")
    )
      currentByStableId.set(stableId, item);
  }
  const context = { input, priorIds, currentByStableId };
  const ordered = [...input.currentSection.items].sort(compareIdentityOrder);
  const project = (
    items: readonly SectionItem[],
    source: StatusOverviewItem["source"],
  ) => items.map((item, index) => toOverviewItem(item, source, index, context));
  const historicalColumn = (
    results: boolean,
  ): StatusOverviewUnit["columns"]["lastWeek"] => {
    if (input.previousPlan.availability === "unavailable")
      return {
        availability: "unavailable",
        reason: input.previousPlan.reason,
        items: [],
      };
    const records = (previous?.items ?? []).filter((item) => {
      const parent = statusOverviewItemParent(item);
      return (
        parent?.kind === kind &&
        parent.id === id &&
        (results ? item.type === "current" : isPreviousPlanItem(item))
      );
    });
    return {
      availability: "available",
      items: records.map((item, index) =>
        toOverviewItem(item, "previous", index, {
          ...context,
          historicalResult: results,
        }),
      ),
    };
  };
  return {
    lastWeek: historicalColumn(true),
    priorCommitments: historicalColumn(false),
    currentWeek: {
      availability: "available",
      items: project(itemsForUnit(ordered, "current", kind, id), "current"),
    },
    nextWeek: {
      availability: "available",
      items: project(itemsForUnit(ordered, "next", kind, id), "next"),
    },
  };
}

export {
  type StatusOverviewActionModel,
  statusOverviewItemActions,
} from "./status-overview-actions";
