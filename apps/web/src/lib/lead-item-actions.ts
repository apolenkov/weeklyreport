import type { ReportSectionReadModel } from "@customreport/shared";

type LeadItem = ReportSectionReadModel["items"][number];

/**
 * Move-in-place patches for the lead form's per-item actions. Kept pure and
 * outside the component so the patch shape is unit-testable without a render.
 * Both are applied to the EXISTING draft row (same object id + durable
 * `stableId` lineage), so per-record review-comment anchors and the
 * published-record deletion lock survive the action.
 */

/** "Mark complete": finish the item where it stands. */
export function markCompletePatch(): Partial<LeadItem> {
  return { workflowStatus: "done" };
}

/**
 * "Move to next week": defer the item into next week. A moved item is a FRESH
 * deferral, not a carried-in row, so `carriedOver` is reset to false —
 * otherwise the automatic carry-over's copy filter (which skips `carriedOver`
 * rows) would never see it again, and a previously carried item moved forward
 * would silently fail to reach the
 * following period. `type` flips to next with `workflowStatus: "postponed"` —
 * the mid-flight push-out IS the deferred state (the unified view's "deferred"
 * bucket keys on it). The `stableId` lineage is untouched, so the
 * published-lock and comment anchors still hold.
 */
export function moveToNextWeekPatch(): Partial<LeadItem> {
  return { type: "next", workflowStatus: "postponed", carriedOver: false };
}

/**
 * "Move to current week": pull a next-week (planned/postponed) item back into
 * the current week as active work. Mirror of `moveToNextWeekPatch` — the same
 * `carriedOver: false` reset applies so the automatic carry-over's copy filter
 * still sees the relocated row, and `workflowStatus: "in-progress"` reflects
 * that the pulled-in item is now this week's in-flight work. The `stableId`
 * lineage is untouched, so the published-lock and comment anchors still hold.
 */
export function moveToCurrentWeekPatch(): Partial<LeadItem> {
  return { type: "current", workflowStatus: "in_progress", carriedOver: false };
}
