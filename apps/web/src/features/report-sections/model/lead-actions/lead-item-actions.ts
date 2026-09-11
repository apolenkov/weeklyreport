import type { ReportSectionReadModel } from "@customreport/shared";

type LeadItem = ReportSectionReadModel["items"][number];

// Pure patches for lead form item actions — applied to the existing draft row
// so stableId lineage (comment anchors, published-lock) survives.

export function markCompletePatch(): Partial<LeadItem> {
  // A completed item can no longer carry a next-period commitment, so clear it;
  // otherwise the whole draft save is rejected by the write schema.
  return { workflowStatus: "done", nextStepText: null };
}

// Reset carriedOver so the automatic carry-over copy filter still sees the row;
// postponed is the deferred state the unified view buckets on. A committed next
// step only belongs to unfinished current work, so drop it on the move.
export function moveToNextWeekPatch(): Partial<LeadItem> {
  return {
    type: "next",
    workflowStatus: "postponed",
    carriedOver: false,
    nextStepText: null,
  };
}

// Mirror of moveToNextWeekPatch — carriedOver false keeps carry-over filter happy.
export function moveToCurrentWeekPatch(): Partial<LeadItem> {
  return { type: "current", workflowStatus: "in_progress", carriedOver: false };
}

// Reason is required at the UI entry point; the write schema validates it.
export function pauseItemPatch(reason: string): Partial<LeadItem> {
  return { workflowStatus: "paused", pausedReason: reason };
}
