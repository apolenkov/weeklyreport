import { describe, expect, it } from "vitest";

import { LEAD_IGOR_ID, LEAD_MARIA_ID } from "../support/seed-constants.js";
import { assertMarketingCrossAuthorCoverage } from "./seed-profile-journeys.js";

const contributions = [
  {
    reportSection: { authorId: LEAD_MARIA_ID },
    stageNames: ["DevOps"],
  },
  {
    reportSection: { authorId: LEAD_IGOR_ID },
    stageNames: ["Testing"],
  },
] as const;

const assignments = [
  { userId: LEAD_MARIA_ID, stage: { name: "DevOps" } },
  { userId: LEAD_IGOR_ID, stage: { name: "Testing" } },
] as const;

describe("full-profile Marketing portal cross-author journey", () => {
  it("accepts exact contributor-to-stage coverage", () => {
    expect(() =>
      assertMarketingCrossAuthorCoverage(contributions, assignments),
    ).not.toThrow();
  });

  it("rejects a missing contributor assignment", () => {
    expect(() =>
      assertMarketingCrossAuthorCoverage(
        contributions,
        assignments.slice(0, 1),
      ),
    ).toThrow("both Marketing portal cross-author contributors");
  });

  it("rejects content outside the final stage assignment", () => {
    const mismatched = [
      contributions[0],
      {
        reportSection: { authorId: LEAD_IGOR_ID },
        stageNames: ["Development"],
      },
    ] as const;
    expect(() =>
      assertMarketingCrossAuthorCoverage(mismatched, assignments),
    ).toThrow("aligns Marketing portal cross-author rows");
  });
});
