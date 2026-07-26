// Derived by-state buckets for the opt-in unified activity view (ADR 0011).
// Presentation only — `workflowStatus` is the source; no failed/blocked bucket;
// `carriedOver` is provenance and must not discriminate into deferred.

export type ActivityBucket =
  "done" | "in-progress" | "paused" | "planned-next" | "deferred";

export interface BucketInput {
  readonly type: "current" | "next";
  readonly workflowStatus:
    "planned" | "in_progress" | "paused" | "postponed" | "done";
  readonly carriedOver: boolean;
}

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
