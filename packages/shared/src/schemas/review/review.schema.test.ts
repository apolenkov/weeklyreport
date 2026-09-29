import { describe, expect, it } from "vitest";

import {
  REVIEW_COMMENT_MAX_LENGTH,
  reviewVerdictInputSchema,
  sectionReviewViewSchema,
} from "./review.schema";

const base = {
  reportSectionId: "6f1b0c5e-2f0a-4b53-9d43-0c2f4a1b7e11",
  version: 2,
};

describe("reviewVerdictInputSchema comment rule", () => {
  it("requires a visible comment for changes_requested", () => {
    for (const comment of [undefined, "", "   ", "​"]) {
      expect(
        reviewVerdictInputSchema.safeParse({
          ...base,
          verdict: "changes_requested",
          comment,
        }).success,
      ).toBe(false);
    }
  });

  it("accepts a comment up to the limit and rejects longer text", () => {
    const ok = (comment: string) =>
      reviewVerdictInputSchema.safeParse({
        ...base,
        verdict: "changes_requested",
        comment,
      }).success;
    expect(ok("x".repeat(REVIEW_COMMENT_MAX_LENGTH))).toBe(true);
    expect(ok("x".repeat(REVIEW_COMMENT_MAX_LENGTH + 1))).toBe(false);
  });

  it("accepts approved only without a comment", () => {
    expect(
      reviewVerdictInputSchema.safeParse({ ...base, verdict: "approved" })
        .success,
    ).toBe(true);
    expect(
      reviewVerdictInputSchema.safeParse({
        ...base,
        verdict: "approved",
        comment: "Looks good",
      }).success,
    ).toBe(false);
  });
});

describe("sectionReviewViewSchema", () => {
  it("carries the optional reviewer comment", () => {
    const view = {
      reviewerId: base.reportSectionId,
      verdict: "changes_requested",
      judgedVersion: 2,
      isCurrent: true,
      createdAt: new Date(),
    };
    expect(sectionReviewViewSchema.parse({ ...view, comment: "Fix X" }).comment).toBe(
      "Fix X",
    );
    expect(sectionReviewViewSchema.parse(view).comment).toBeUndefined();
  });
});
