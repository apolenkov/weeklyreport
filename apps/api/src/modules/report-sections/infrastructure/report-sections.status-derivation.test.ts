import { describe, expect, it } from "vitest";

import { deriveEffectiveProductStatus } from "./report-sections.status-derivation";

const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_PROJECT_ID = "55555555-5555-4555-8555-555555555555";

describe("deriveEffectiveProductStatus", () => {
  it("floors Development red for a blocked Dev risk", () => {
    const status = deriveEffectiveProductStatus({
      projectId: PROJECT_ID,
      trafficLight: "green",
      ownedStages: [{ stageName: "Development", status: null }],
      risks: [
        {
          projectId: PROJECT_ID,
          severity: "blocked",
          stageNames: ["Dev"],
        },
      ],
    });

    expect(status).toBe("red");
  });

  it("keeps a populated non-matching stage list scoped", () => {
    const status = deriveEffectiveProductStatus({
      projectId: PROJECT_ID,
      trafficLight: "green",
      ownedStages: [{ stageName: "Development", status: null }],
      risks: [
        {
          projectId: PROJECT_ID,
          severity: "blocked",
          stageNames: ["Testing"],
        },
      ],
    });

    expect(status).toBe("green");
  });

  it("scopes risks to their product before matching the stage", () => {
    const status = deriveEffectiveProductStatus({
      projectId: PROJECT_ID,
      trafficLight: "green",
      ownedStages: [{ stageName: "Development", status: null }],
      risks: [
        {
          projectId: OTHER_PROJECT_ID,
          severity: "blocked",
          stageNames: ["Dev"],
        },
      ],
    });

    expect(status).toBe("green");
  });
});
