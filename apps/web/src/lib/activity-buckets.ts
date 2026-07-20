/**
 * Derived by-state buckets for the opt-in unified activity view (ADR 0011).
 *
 * A pure presentation projection over the persisted item fields — no new enum
 * is stored and physical `Item.type` (`current|next`) is untouched. Since
 * rework-item-status-model the stored `workflowStatus` is the single source
 * (no completed flag, no stored blocked), so the projection is a direct read:
 *
 *   done         — finished work, whatever the week.
 *   paused       — current-week work on hold (owner intends to resume).
 *   deferred     — a `postponed` next-week item: work consciously pushed
 *                  beyond the period.
 *   planned-next — `planned` next-week items.
 *   in-progress  — everything else (current-week open work).
 *
 * There is NO `failed` or `blocked` bucket: an impediment is a blocker RISK
 * covering the item, never an item status. `carriedOver` is accepted as input
 * for the contract's sake but deliberately never discriminates: it means
 * "arrived from the previous period as current" — provenance, not state — and
 * MUST NOT read as "deferred" (a carried item buckets by its live state).
 */

export type ActivityBucket =
  "done" | "in-progress" | "paused" | "planned-next" | "deferred";

export interface BucketInput {
  readonly type: "current" | "next";
  readonly workflowStatus:
    "planned" | "in_progress" | "paused" | "postponed" | "done";
  readonly carriedOver: boolean;
}

/** Display order of the unified section's groups. */
export const ACTIVITY_BUCKET_ORDER: readonly ActivityBucket[] = [
  "in-progress",
  "paused",
  "planned-next",
  "deferred",
  "done",
];

export const ACTIVITY_BUCKET_LABELS: Readonly<Record<ActivityBucket, string>> =
  {
    done: "Done",
    "in-progress": "In Progress",
    paused: "Paused",
    "planned-next": "Planned Next",
    deferred: "Deferred",
  };

export function deriveActivityBucket(input: BucketInput): ActivityBucket {
  switch (input.workflowStatus) {
    case "done":
      return "done";
    case "paused":
      return "paused";
    case "postponed":
      return "deferred";
    case "planned":
      return "planned-next";
    case "in_progress":
      return "in-progress";
  }
}
