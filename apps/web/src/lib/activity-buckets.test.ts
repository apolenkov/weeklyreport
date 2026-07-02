import { describe, expect, it } from "vitest";

import {
  ACTIVITY_BUCKET_ORDER,
  type ActivityBucket,
  type BucketInput,
  deriveActivityBucket,
} from "./activity-buckets";

const TYPES = ["current", "next"] as const;
const WORKFLOW_STATUSES = ["done", "in_progress", "blocked"] as const;
const COMPLETED = [true, false, null] as const;
const CARRIED = [true, false] as const;

function allCombos(): BucketInput[] {
  return TYPES.flatMap((type) =>
    WORKFLOW_STATUSES.flatMap((workflowStatus) =>
      COMPLETED.flatMap((completed) =>
        CARRIED.map((carriedOver) => ({
          type,
          workflowStatus,
          completed,
          carriedOver,
        })),
      ),
    ),
  );
}

describe("deriveActivityBucket", () => {
  it("is total: every (type × status × completed × carriedOver) combo lands in exactly one bucket", () => {
    const known = new Set<ActivityBucket>(ACTIVITY_BUCKET_ORDER);
    for (const combo of allCombos()) {
      const bucket = deriveActivityBucket(combo);
      expect(known.has(bucket)).toBe(true);
    }
    // 2 × 3 × 3 × 2 = 36 combos, each mapped (no throw above).
    expect(allCombos()).toHaveLength(36);
  });

  it("is deterministic", () => {
    for (const combo of allCombos()) {
      expect(deriveActivityBucket(combo)).toBe(deriveActivityBucket(combo));
    }
  });

  it("never produces a 'failed' bucket", () => {
    for (const combo of allCombos()) {
      expect(deriveActivityBucket(combo)).not.toBe("failed");
    }
  });

  it("a carried item is bucketed by its live state, never as 'deferred'", () => {
    // The carry-over clone shape: type=current, completed=null, carriedOver.
    expect(
      deriveActivityBucket({
        type: "current",
        workflowStatus: "in_progress",
        completed: null,
        carriedOver: true,
      }),
    ).toBe("in-progress");
    // carriedOver never discriminates: flipping it never changes the bucket.
    for (const combo of allCombos()) {
      expect(deriveActivityBucket({ ...combo, carriedOver: true })).toBe(
        deriveActivityBucket({ ...combo, carriedOver: false }),
      );
    }
  });

  it("applies the documented precedence: done > blocked > week split", () => {
    expect(
      deriveActivityBucket({
        type: "current",
        workflowStatus: "done",
        completed: null,
        carriedOver: false,
      }),
    ).toBe("done");
    expect(
      deriveActivityBucket({
        type: "next",
        workflowStatus: "blocked",
        completed: true,
        carriedOver: false,
      }),
    ).toBe("done");
    expect(
      deriveActivityBucket({
        type: "next",
        workflowStatus: "blocked",
        completed: false,
        carriedOver: false,
      }),
    ).toBe("blocked");
  });

  it("splits next-week items into planned-next (fresh) vs deferred (pushed out mid-flight)", () => {
    expect(
      deriveActivityBucket({
        type: "next",
        workflowStatus: "in_progress",
        completed: null,
        carriedOver: false,
      }),
    ).toBe("planned-next");
    // "Move to next week" writes completed=false — the deferred marker.
    expect(
      deriveActivityBucket({
        type: "next",
        workflowStatus: "in_progress",
        completed: false,
        carriedOver: false,
      }),
    ).toBe("deferred");
  });

  it("keeps an open current-week item in-progress", () => {
    expect(
      deriveActivityBucket({
        type: "current",
        workflowStatus: "in_progress",
        completed: false,
        carriedOver: false,
      }),
    ).toBe("in-progress");
  });
});
