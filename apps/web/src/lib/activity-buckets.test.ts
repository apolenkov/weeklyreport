import { describe, expect, it } from "vitest";

import {
  ACTIVITY_BUCKET_ORDER,
  type ActivityBucket,
  type BucketInput,
  deriveActivityBucket,
} from "./activity-buckets";

const TYPES = ["current", "next"] as const;
const WORKFLOW_STATUSES = [
  "planned",
  "in_progress",
  "paused",
  "postponed",
  "done",
] as const;
const CARRIED = [true, false] as const;

function allCombos(): BucketInput[] {
  return TYPES.flatMap((type) =>
    WORKFLOW_STATUSES.flatMap((workflowStatus) =>
      CARRIED.map((carriedOver) => ({
        type,
        workflowStatus,
        carriedOver,
      })),
    ),
  );
}

describe("deriveActivityBucket", () => {
  it("is total: every (type × workflowStatus × carriedOver) combo lands in exactly one bucket", () => {
    const known = new Set<ActivityBucket>(ACTIVITY_BUCKET_ORDER);
    for (const combo of allCombos()) {
      const bucket = deriveActivityBucket(combo);
      expect(known.has(bucket)).toBe(true);
    }
    // 2 × 5 × 2 = 20 combos, each mapped (no throw above).
    expect(allCombos()).toHaveLength(20);
  });

  it("is deterministic and matches the fixed workflow-status mapping for every combination", () => {
    // Independent oracle: the expected bucket for each workflowStatus, keyed
    // verbatim — not derived from the implementation under test.
    const EXPECTED: Readonly<
      Record<BucketInput["workflowStatus"], ActivityBucket>
    > = {
      done: "done",
      paused: "paused",
      postponed: "deferred",
      planned: "planned-next",
      in_progress: "in-progress",
    };
    for (const combo of allCombos()) {
      expect(deriveActivityBucket(combo)).toBe(EXPECTED[combo.workflowStatus]);
    }
  });

  it("never produces a 'failed' or 'blocked' bucket", () => {
    for (const combo of allCombos()) {
      expect(deriveActivityBucket(combo)).not.toBe("failed");
      expect(deriveActivityBucket(combo)).not.toBe("blocked");
    }
  });

  it("carriedOver never discriminates: flipping it never changes the bucket", () => {
    for (const combo of allCombos()) {
      expect(deriveActivityBucket({ ...combo, carriedOver: true })).toBe(
        deriveActivityBucket({ ...combo, carriedOver: false }),
      );
    }
  });

  it("a carried current-week in_progress item stays in-progress, never 'deferred'", () => {
    // The carry-over clone shape: type=current, carriedOver=true.
    expect(
      deriveActivityBucket({
        type: "current",
        workflowStatus: "in_progress",
        carriedOver: true,
      }),
    ).toBe("in-progress");
  });

  it("reads the workflow status verbatim regardless of type", () => {
    for (const type of TYPES) {
      expect(
        deriveActivityBucket({
          type,
          workflowStatus: "done",
          carriedOver: false,
        }),
      ).toBe("done");
      expect(
        deriveActivityBucket({
          type,
          workflowStatus: "paused",
          carriedOver: false,
        }),
      ).toBe("paused");
      expect(
        deriveActivityBucket({
          type,
          workflowStatus: "in_progress",
          carriedOver: false,
        }),
      ).toBe("in-progress");
    }
  });

  it("maps 'postponed' to 'deferred' — a next-week item consciously pushed out", () => {
    expect(
      deriveActivityBucket({
        type: "next",
        workflowStatus: "postponed",
        carriedOver: false,
      }),
    ).toBe("deferred");
  });

  it("maps 'planned' to 'planned-next'", () => {
    expect(
      deriveActivityBucket({
        type: "next",
        workflowStatus: "planned",
        carriedOver: false,
      }),
    ).toBe("planned-next");
  });
});
