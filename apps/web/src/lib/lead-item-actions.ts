import type { ReportSectionReadModel } from "@customreport/shared";

type LeadItem = ReportSectionReadModel["items"][number];

// Pure patches for lead form item actions — applied to the existing draft row
// so stableId lineage (comment anchors, published-lock) survives.

/**
 * Mark Complete Patch.
 */
export function markCompletePatch(): Partial<LeadItem> {
  return { workflowStatus: "done" };
}

// Reset carriedOver so the automatic carry-over copy filter still sees the row;
// postponed is the deferred state the unified view buckets on.
/**
 * Move To Next Week Patch.
 */
export function moveToNextWeekPatch(): Partial<LeadItem> {
  return { type: "next", workflowStatus: "postponed", carriedOver: false };
}

// Mirror of moveToNextWeekPatch — carriedOver false keeps carry-over filter happy.
/**
 * Move To Current Week Patch.
 */
export function moveToCurrentWeekPatch(): Partial<LeadItem> {
  return { type: "current", workflowStatus: "in_progress", carriedOver: false };
}

// Reason is required at the UI entry point; schema stays permissive for legacy rows.
/**
 * Pause Item Patch.
 * @param reason - The reason argument.
 */
export function pauseItemPatch(reason: string): Partial<LeadItem> {
  return { workflowStatus: "paused", pausedReason: reason };
}
