import type { ReportSectionReadModel } from "@customreport/shared";

import type { DraftPatch } from "../lead-form/draft/lead-form-draft-patch";

type LeadItem = ReportSectionReadModel["items"][number];

// Pure patches for lead form item actions — applied to the existing draft row
// so stableId lineage (comment anchors, published-lock) survives.

export function markCompletePatch(): Partial<LeadItem> {
  // A completed item can no longer carry a next-period commitment, so clear it;
  // otherwise the whole draft save is rejected by the write schema.
  return { workflowStatus: "done", nextStepText: null };
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

export function buildMoveItemPatch(
  section: ReportSectionReadModel,
  itemId: string,
  target: "current" | "next",
): DraftPatch | null {
  if (section.status !== "draft") return null;
  const item = section.items.find((candidate) => candidate.id === itemId);
  if (!item || item.type === target || cannotMove(item)) return null;
  if (
    item.stableId &&
    section.items.some(
      (candidate) =>
        candidate.id !== item.id &&
        candidate.stableId === item.stableId &&
        candidate.type === target,
    )
  ) {
    return null;
  }
  return {
    kind: "item-patch",
    itemId,
    patch: target === "next" ? moveToNextWeekPatch() : moveToCurrentWeekPatch(),
  };
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

// MOVE-LOCKED: completed or resolved records cannot acquire a continuation or be
// promoted. Read-only/foreign/historical rejection stays at the action layer.
export function canContinueOrPromote(item: Partial<LeadItem>): boolean {
  return item.workflowStatus !== "done" && item.resolution == null;
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
