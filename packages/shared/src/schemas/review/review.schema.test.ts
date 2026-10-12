import { describe, expect, it } from "vitest";

import {
  recordCommentViewSchema,
  REVIEW_COMMENT_MAX_LENGTH,
  reviewVerdictInputSchema,
  sectionReviewViewSchema,
} from "./review.schema.js";

const base = {
  reportSectionId: "6f1b0c5e-2f0a-4b53-9d43-0c2f4a1b7e11",
  version: 2,
};

describe("reviewVerdictInputSchema comment rule", () => {
  it("requires a visible comment for changes_requested", () => {
    for (const comment of [undefined, "", " ".repeat(3), "​"]) {
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

  it("trims the comment before validating and returning it", () => {
    const parsed = reviewVerdictInputSchema.parse({
      ...base,
      verdict: "changes_requested",
      comment: "  Add a risk owner.  ",
    });
    expect(parsed.comment).toBe("Add a risk owner.");
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
    expect(
      sectionReviewViewSchema.parse({ ...view, comment: "Fix X" }).comment,
    ).toBe("Fix X");
    expect(sectionReviewViewSchema.parse(view).comment).toBeUndefined();
  });
});

describe.each([
  [
    "record comment text",
    recordCommentViewSchema,
    {
      id: "6f1b0c5e-2f0a-4b53-9d43-0c2f4a1b7e12",
      reviewerId: base.reportSectionId,
      createdAt: "2026-10-12T00:00:00.000Z",
    },
    "text",
  ],
  [
    "verdict comment",
    sectionReviewViewSchema,
    {
      reviewerId: base.reportSectionId,
      verdict: "changes_requested",
      judgedVersion: 2,
      isCurrent: true,
      createdAt: "2026-10-12T00:00:00.000Z",
    },
    "comment",
  ],
] as const)("%s read format", (_label, schema, view, field) => {
  it.each([
    ["whitespace-only text", " ".repeat(3)],
    ["invisible-only text", "\u200B\u200C\u200D\uFEFF"],
    ["a null byte", "Review\u0000text"],
    ["text above 2000 characters", "x".repeat(2001)],
  ])("rejects %s at its own field", (_case, value) => {
    const result = schema.safeParse({ ...view, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: [field] }),
      );
    }
  });

  it.each([
    ["the exact 2000-character boundary", "x".repeat(2000)],
    [
      "multiline text with surrounding spaces",
      "  Add a risk owner.\nNext line.  ",
    ],
  ])("preserves %s without normalization", (_case, value) => {
    const result = schema.safeParse({ ...view, [field]: value });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ [field]: value });
    }
  });
});
