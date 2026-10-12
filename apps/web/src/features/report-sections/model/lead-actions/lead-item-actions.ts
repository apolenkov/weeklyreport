import type { ReportSectionReadModel } from "@weeklyreport/shared";

import type { DraftPatch } from "../lead-form/draft/lead-form-draft-patch";

type LeadItem = ReportSectionReadModel["items"][number];

// Pure patches for lead form item actions — applied to the existing draft row
// so stableId lineage (comment anchors, published-lock) survives.

export function markCompletePatch(): Partial<LeadItem> {
  // A completed item can no longer carry a next-period commitment, so clear it;
  // otherwise the whole draft save is rejected by the write schema.
  return {
    workflowStatus: "done",
    nextStepText: null,
    pausedReason: null,
    carriedOver: false,
  };
}

// Moving is a placement change. Reset the carry marker only when explicitly
// planning Next so the occurrence stays eligible for a later carry-over.
export function moveToNextWeekPatch(): Partial<LeadItem> {
  return {
    type: "next",
    carriedOver: false,
  };
}

// Pulling a planned occurrence into Current does not assert progress or resume
// paused work; every saved field except week placement remains unchanged.
export function moveToCurrentWeekPatch(): Partial<LeadItem> {
  return { type: "current" };
}

const cannotMove = (item: LeadItem): boolean =>
  item.workflowStatus === "done" ||
  item.resolution != null ||
  Boolean(item.nextStepText?.trim());

// A stableId holds at most one active record per week placement, so moving an
// item into `target` is unsafe while another record already sits there.
export function hasOtherPlacement(
  items: readonly LeadItem[],
  item: LeadItem,
  target: LeadItem["type"],
): boolean {
  return (
    item.stableId != null &&
    items.some(
      (candidate) =>
        candidate.id !== item.id &&
        candidate.stableId === item.stableId &&
        candidate.type === target,
    )
  );
}

export function buildMoveItemPatch(
  section: ReportSectionReadModel,
  itemId: string,
  target: "current" | "next",
): DraftPatch | null {
  if (section.status !== "draft") return null;
  const item = section.items.find((candidate) => candidate.id === itemId);
  if (!item || item.type === target || cannotMove(item)) return null;
  if (hasOtherPlacement(section.items, item, target)) return null;
  return {
    kind: "item-patch",
    itemId,
    patch: target === "next" ? moveToNextWeekPatch() : moveToCurrentWeekPatch(),
  };
}

// The submit blocker (UNCONFIRMED_CARRIED_ITEM) and the review counter share
// this predicate so the counter reaches zero exactly when the blocker clears.
export function isUnconfirmedCarried(item: {
  readonly type: LeadItem["type"];
  readonly carriedOver?: boolean | undefined;
}): boolean {
  return item.type === "current" && item.carriedOver === true;
}

export function buildConfirmCarriedItemPatch(
  section: ReportSectionReadModel,
  itemId: string,
): DraftPatch | null {
  if (section.status !== "draft") return null;
  const item = section.items.find((candidate) => candidate.id === itemId);
  return item?.type === "current" && item.carriedOver
    ? { kind: "item-patch", itemId, patch: { carriedOver: false } }
    : null;
}

// One patch clears the marker on every pending continuation; rows without it
// (already decided) stay untouched. Null when nothing is pending.
export function buildConfirmAllCarriedPatch(
  section: ReportSectionReadModel,
): DraftPatch | null {
  if (section.status !== "draft") return null;
  return section.items.some(isUnconfirmedCarried)
    ? { kind: "confirm-carried" }
    : null;
}

// Reason is required at the UI entry point; the write schema validates it.
export function pauseItemPatch(reason: string): Partial<LeadItem> {
  return { workflowStatus: "paused", pausedReason: reason };
}

// Accepted MOVE-CURRENT-NEXT: keep the Current row and record the Next intent on
// it. Never type-flip (that would remove Current) and never clear an existing
// commitment silently — callers must resolve continuationConflict first.
export function continueToNextPatch(nextText: string): Partial<LeadItem> {
  return { type: "current", nextStepText: nextText };
}

// Accepted MOVE-NEXT-CURRENT: the continuation becomes the current result.
// The superseded text is retained by the outcome/history layer before this patch
// replaces `text`; the commitment and any pause/carry flags are cleared.
export function promoteContinuationPatch(nextText: string): Partial<LeadItem> {
  return {
    type: "current",
    text: nextText,
    nextStepText: null,
    workflowStatus: "in_progress",
    carriedOver: false,
    pausedReason: null,
  };
}

// MOVE-COMMITMENT: a different non-blank commitment already exists, so the
// caller must ask for explicit selection instead of replacing it.
export function continuationConflict(
  item: Pick<LeadItem, "nextStepText">,
  proposed: string,
): boolean {
  const existing = item.nextStepText?.trim() ?? "";
  return existing !== "" && existing !== proposed.trim();
}
