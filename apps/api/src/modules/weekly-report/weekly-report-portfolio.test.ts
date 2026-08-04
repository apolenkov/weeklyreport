import { describe, expect, it } from "vitest";

import { buildPortfolioOverview } from "./weekly-report-portfolio";

const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

describe("buildPortfolioOverview — raw traffic-light parsing", () => {
  it("folds valid statuses into the worst-of card", () => {
    const overview = buildPortfolioOverview(
      [{ id: PROJECT_ID, name: "CRM Portal", stageAssignments: [] }],
      [
        {
          authorId: "lead-a",
          authorName: "Lead A",
          projects: [{ projectId: PROJECT_ID, trafficLight: "red" }],
        },
        {
          authorId: "lead-b",
          authorName: "Lead B",
          projects: [{ projectId: PROJECT_ID, trafficLight: "green" }],
        },
      ],
    );

    expect(overview[0]?.worstStatus).toBe("red");
    expect(overview[0]?.leadNames).toEqual(["Lead A", "Lead B"]);
  });

  it("skips an out-of-enum raw status instead of casting it through", () => {
    const overview = buildPortfolioOverview(
      [{ id: PROJECT_ID, name: "CRM Portal", stageAssignments: [] }],
      [
        {
          authorId: "lead-a",
          authorName: "Lead A",
          projects: [{ projectId: PROJECT_ID, trafficLight: "chartreuse" }],
        },
      ],
    );

    // No valid light → the worst-of fold over an empty set stays null.
    expect(overview[0]?.worstStatus).toBeNull();
  });
});
