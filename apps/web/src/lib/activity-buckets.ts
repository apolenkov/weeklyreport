/**
 * Derived by-state buckets for the opt-in unified activity view (ADR 0011).
 *
 * A pure presentation projection over the persisted item fields — no new enum
 * is stored and physical `Item.type` (`current|next`) is untouched. The
 * function is TOTAL and deterministic: every (type × workflowStatus ×
 * completed × carriedOver) combination lands in exactly one bucket, by
 * explicit precedence (the fields are not orthogonal):
 *
 *   1. done      — `workflowStatus="done"` or `completed=true`, whatever the
 *                  week: finished work outranks every other signal.
 *   2. blocked   — `workflowStatus="blocked"`: an impediment outranks the
 *                  week split (a blocked next-week item is still blocked).
 *   3. deferred  — a next-week item carrying the in-progress marker
 *                  (`completed=false`): work consciously pushed out of the
 *                  current week ("move to next week" writes exactly this).
 *   4. planned-next — the remaining next-week items (`completed=null`, the
 *                  fresh "Planned" marker).
 *   5. in-progress — everything else (current-week open work).
 *
 * There is NO `failed` bucket. `carriedOver` is accepted as input for the
 * contract's sake but deliberately never discriminates: it means "arrived
 * from the previous period as current" — provenance, not state — and MUST NOT
 * read as "deferred" (a carried item buckets by its live workflow state).
 */

export type ActivityBucket =
  | "done"
  | "in-progress"
  | "blocked"
  | "planned-next"
  | "deferred";

export interface BucketInput {
  readonly type: "current" | "next";
  readonly workflowStatus: "done" | "in_progress" | "blocked";
  readonly completed: boolean | null;
  readonly carriedOver: boolean;
}

/** Display order of the unified section's groups. */
export const ACTIVITY_BUCKET_ORDER: readonly ActivityBucket[] = [
  "blocked",
  "in-progress",
  "planned-next",
  "deferred",
  "done",
];

export const ACTIVITY_BUCKET_LABELS: Readonly<Record<ActivityBucket, string>> =
  {
    done: "Done",
    "in-progress": "In Progress",
    blocked: "Blocked",
    "planned-next": "Planned Next",
    deferred: "Deferred",
  };

export function deriveActivityBucket(input: BucketInput): ActivityBucket {
  if (input.workflowStatus === "done" || input.completed === true)
    return "done";
  if (input.workflowStatus === "blocked") return "blocked";
  if (input.type === "next") {
    return input.completed === false ? "deferred" : "planned-next";
  }
  return "in-progress";
}
