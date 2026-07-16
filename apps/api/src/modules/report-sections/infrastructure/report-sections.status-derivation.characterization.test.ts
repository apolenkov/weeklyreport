import type { RiskSeverity, TrafficLightStatus } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  deriveActivityStatus,
  deriveEffectiveProductStatus,
} from "./report-sections.status-derivation";

/**
 * Pins `deriveEffectiveProductStatus` and
 * `deriveActivityStatus`'s current output over the severity × items ×
 * explicit-status permutation grid (traffic vocabulary, incl. `null`
 * handling) BEFORE the ranking core moves to the shared package. Frozen — do
 * not edit assertions after the move lands; a diff here means a behavior
 * change.
 */
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

describe("deriveEffectiveProductStatus — characterization grid", () => {
  const trafficLights: readonly (TrafficLightStatus | null)[] = [
    "green",
    "yellow",
    "red",
    null,
  ];
  const stageStatuses: readonly (string | null)[] = [
    "green",
    "yellow",
    "red",
    null,
  ];
  const riskSets: {
    readonly label: string;
    readonly risks: readonly {
      severity: RiskSeverity;
      stageIds?: readonly string[];
    }[];
  }[] = [
    { label: "no risks", risks: [] },
    {
      label: "covering at-risk",
      risks: [{ severity: "at-risk", stageIds: ["Development"] }],
    },
    {
      label: "covering blocked",
      risks: [{ severity: "blocked", stageIds: ["Development"] }],
    },
    {
      label: "non-covering risk",
      risks: [{ severity: "blocked", stageIds: ["Testing"] }],
    },
  ];

  const cases = trafficLights.flatMap((trafficLight) =>
    stageStatuses.flatMap((stageStatus) =>
      riskSets.map((riskSet) => ({
        trafficLight,
        stageStatus,
        riskLabel: riskSet.label,
        risks: riskSet.risks,
      })),
    ),
  );

  it.each(cases)(
    "trafficLight=$trafficLight stageStatus=$stageStatus risks=$riskLabel",
    ({ trafficLight, stageStatus, risks }) => {
      const status = deriveEffectiveProductStatus({
        projectId: PROJECT_ID,
        trafficLight,
        ownedStages: [{ stageName: "Development", status: stageStatus }],
        risks: risks.map((r) => ({ ...r, projectId: PROJECT_ID })),
      });
      expect(status).toMatchSnapshot();
    },
  );

  it("no owned stages: raw trafficLight passes through unchanged", () => {
    expect(
      deriveEffectiveProductStatus({
        projectId: PROJECT_ID,
        trafficLight: "yellow",
        ownedStages: [],
        risks: [{ projectId: PROJECT_ID, severity: "blocked" }],
      }),
    ).toBe("yellow");
  });

  it("scopes risks to the product before matching the stage", () => {
    expect(
      deriveEffectiveProductStatus({
        projectId: PROJECT_ID,
        trafficLight: "green",
        ownedStages: [{ stageName: "Development", status: null }],
        risks: [
          {
            projectId: "other-project",
            severity: "blocked",
            stageIds: ["Development"],
          },
        ],
      }),
    ).toBe("green");
  });
});

describe("deriveActivityStatus — characterization grid", () => {
  const storedStatuses: readonly (TrafficLightStatus | null)[] = [
    "green",
    "yellow",
    "red",
    null,
  ];
  const riskSets: {
    readonly label: string;
    readonly risks: readonly { severity: RiskSeverity }[];
  }[] = [
    { label: "no risks", risks: [] },
    { label: "one at-risk", risks: [{ severity: "at-risk" }] },
    { label: "one blocked", risks: [{ severity: "blocked" }] },
    {
      label: "at-risk + blocked",
      risks: [{ severity: "at-risk" }, { severity: "blocked" }],
    },
  ];

  const cases = storedStatuses.flatMap((stored) =>
    riskSets.map((riskSet) => ({
      stored,
      riskLabel: riskSet.label,
      risks: riskSet.risks,
    })),
  );

  it.each(cases)("stored=$stored risks=$riskLabel", ({ stored, risks }) => {
    const result = deriveActivityStatus(stored, risks);
    expect(result).toMatchSnapshot();
  });
});
