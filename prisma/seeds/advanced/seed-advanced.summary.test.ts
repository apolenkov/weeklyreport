import { describe, expect, it, vi } from "vitest";

import { logSeedSummary } from "./seed-advanced.summary.js";

describe("logSeedSummary", () => {
  it("prints counts supplied by the seed writers", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logSeedSummary({
      groups: 3,
      users: 9,
      products: 8,
      stages: 7,
      stageAssignments: 11,
      reports: 5,
      sections: {
        sections: 20,
        items: 30,
        projectStatuses: 22,
        stageStatuses: 14,
      },
      risks: 6,
      decisions: 4,
      reminderPolicies: 3,
      reminderRules: 9,
      viewerGroupAccesses: 2,
      reopenRequests: 1,
      actionLogs: 1,
    });

    expect(log).toHaveBeenCalledWith(
      "Seeded: 3 groups, 9 users, 8 products, 7 stages, 11 assignments, " +
        "5 reports, 20 sections, 30 items, 22 project statuses, 14 stage statuses, 6 risks, " +
        "4 decisions, 3 reminder policies, 9 reminder rules, " +
        "2 viewer group accesses, 1 reopen request, 1 action log",
    );
  });
});
