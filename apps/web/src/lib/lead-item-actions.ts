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
  return { workflowStatus: "done", completed: true };
}

/**
 * "Move to next week": defer the item into next week. A moved item is a FRESH
 * deferral, not a carried-in row, so `carriedOver` is reset to false —
 * otherwise both `carryOver.execute`'s filter and the uncarried-open-work
 * banner (which both skip `carriedOver` rows) would never see it again, and a
 * previously carried item moved forward would silently fail to reach the
 * following period. `type` flips to next and `completed=false` marks the
 * mid-flight push-out (the unified view's "deferred" bucket); `workflowStatus`
 * is preserved so a blocked item stays blocked. The `stableId` lineage is
 * untouched, so the published-lock and comment anchors still hold.
 */
export function moveToNextWeekPatch(): Partial<LeadItem> {
  return { type: "next", completed: false, carriedOver: false };
}
