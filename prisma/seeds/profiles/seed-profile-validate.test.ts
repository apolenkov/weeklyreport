import { describe, expect, it } from "vitest";

import { formatSeedProfileValidationSummary } from "./seed-profile-validate.js";

describe("seed profile validation summary", () => {
  it("prints only the profile and bounded row counts", () => {
    const summary = formatSeedProfileValidationSummary({
      profile: "full",
      counts: {
        users: 13,
        projects: 15,
        reports: 8,
        sections: 55,
        items: 221,
      },
      userIds: ["user-id"],
      projectIds: ["project-id"],
      reportIds: ["report-id"],
      itemRecords: [
        { id: "item-id", reportSectionId: "section-id", stableId: "stable-id" },
      ],
      riskRecords: [
        { id: "risk-id", reportSectionId: "section-id", stableId: "stable-id" },
      ],
      decisionRecords: [
        {
          id: "decision-id",
          reportSectionId: "section-id",
          stableId: "stable-id",
          text: "must not be printed",
        },
      ],
      stableText: ["must not be printed"],
    });

    expect(summary).toBe(
      "[seed-profile:full] validated: users=13, projects=15, reports=8, sections=55, items=221",
    );
    expect(summary).not.toContain("item-id");
    expect(summary).not.toContain("must not be printed");
  });
});
