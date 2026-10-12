import { describe, expect, it } from "vitest";

import { buildActivityRiskEntry } from "./risk-edit-dialog-helpers";

describe("buildActivityRiskEntry", () => {
  it("names an activity risk without a resolved activity Unknown", () => {
    const entry = buildActivityRiskEntry({
      existingId: undefined,
      activityId: "activity-1",
      activityName: undefined,
      severity: "at-risk",
      text: "Vendor delay",
      impact: "Release slips",
      mitigation: "Escalate",
    });

    expect(entry.productName).toBe("Unknown");
  });
});
