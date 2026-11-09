import { describe, expect, it } from "vitest";

import { deriveEffectiveProductStatus } from "./effective-product-status.js";

const PRODUCT_ID = "10000000-0000-4000-8000-000000000001";
const DETAILS = { impact: "Delivery slips", mitigation: "Escalate" } as const;

const statusWith = (
  risk: {
    readonly projectId?: string | null;
    readonly impact: string | null;
    readonly mitigation: string | null;
  },
  severity: "blocked" | "at-risk" = "blocked",
) =>
  deriveEffectiveProductStatus({
    projectId: PRODUCT_ID,
    trafficLight: "green",
    ownedStages: [{ stageName: "Development", status: null }],
    risks: [
      {
        projectId: PRODUCT_ID,
        severity,
        stageNames: ["Development"],
        ...risk,
      },
    ],
  });

describe("deriveEffectiveProductStatus — record completeness", () => {
  it.each([
    ["impact", { impact: null, mitigation: "Escalate" }],
    ["mitigation", { impact: "Delivery slips", mitigation: null }],
    ["both details", { impact: null, mitigation: null }],
  ])("a blocked risk without %s floors nothing", (_detail, details) => {
    expect(statusWith(details)).toBe("green");
    expect(statusWith(details, "at-risk")).toBe("green");
  });

  it("the same risk floors its stage once both details are present", () => {
    expect(statusWith(DETAILS)).toBe("red");
    expect(statusWith(DETAILS, "at-risk")).toBe("yellow");
  });

  it("an incomplete risk does not mask a complete one on the same stage", () => {
    expect(
      deriveEffectiveProductStatus({
        projectId: PRODUCT_ID,
        trafficLight: "green",
        ownedStages: [{ stageName: "Development", status: null }],
        risks: [
          {
            projectId: PRODUCT_ID,
            severity: "blocked",
            stageNames: ["Development"],
            impact: null,
            mitigation: null,
          },
          {
            projectId: PRODUCT_ID,
            severity: "at-risk",
            stageNames: ["Development"],
            ...DETAILS,
          },
        ],
      }),
    ).toBe("yellow");
  });

  it("a complete Activity-parented risk still floors no product", () => {
    expect(statusWith({ ...DETAILS, projectId: null })).toBe("green");
  });
});
