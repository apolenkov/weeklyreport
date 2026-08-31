import type { RiskSeverity, TrafficLightStatus } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  deriveActivityStatus,
  deriveEffectiveProductStatus,
} from "./report-sections.status-derivation";

// Grid of the status-derivation rules: a diff in these assertions means a
// behavior change, not a test that needs updating.
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
      stageNames?: readonly string[];
    }[];
    // Rows follow trafficLights; columns follow stageStatuses.
    readonly expected: readonly (readonly (TrafficLightStatus | null)[])[];
  }[] = [
    {
      label: "no risks",
      risks: [],
      expected: [
        ["green", "yellow", "red", "green"],
        ["yellow", "yellow", "red", "yellow"],
        ["red", "red", "red", "red"],
        ["green", "yellow", "red", null],
      ],
    },
    {
      label: "covering at-risk",
      risks: [{ severity: "at-risk", stageNames: ["Development"] }],
      expected: [
        ["yellow", "yellow", "red", "yellow"],
        ["yellow", "yellow", "red", "yellow"],
        ["red", "red", "red", "red"],
        ["yellow", "yellow", "red", "yellow"],
      ],
    },
    {
      label: "covering blocked",
      risks: [{ severity: "blocked", stageNames: ["Development"] }],
      expected: [
        ["red", "red", "red", "red"],
        ["red", "red", "red", "red"],
        ["red", "red", "red", "red"],
        ["red", "red", "red", "red"],
      ],
    },
    {
      label: "non-covering risk",
      risks: [{ severity: "blocked", stageNames: ["Testing"] }],
      expected: [
        ["green", "yellow", "red", "green"],
        ["yellow", "yellow", "red", "yellow"],
        ["red", "red", "red", "red"],
        ["green", "yellow", "red", null],
      ],
    },
  ];

  const cases = trafficLights.flatMap((trafficLight, trafficIndex) =>
    stageStatuses.flatMap((stageStatus, stageIndex) =>
      riskSets.map((riskSet) => ({
        trafficLight,
        stageStatus,
        riskLabel: riskSet.label,
        risks: riskSet.risks,
        expected: riskSet.expected[trafficIndex]?.[stageIndex],
      })),
    ),
  );

  it.each(cases)(
    "trafficLight=$trafficLight stageStatus=$stageStatus risks=$riskLabel",
    ({ trafficLight, stageStatus, risks, expected }) => {
      const status = deriveEffectiveProductStatus({
        projectId: PROJECT_ID,
        trafficLight,
        ownedStages: [{ stageName: "Development", status: stageStatus }],
        risks: risks.map((r) => ({ ...r, projectId: PROJECT_ID })),
      });
      expect(status).toBe(expected);
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
            stageNames: ["Development"],
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

  // Rows follow storedStatuses; columns follow riskSets.
  const expected: readonly {
    readonly derivedStatus: TrafficLightStatus | null;
    readonly alarmFloor: TrafficLightStatus | null;
  }[][] = [
    [
      { derivedStatus: "green", alarmFloor: null },
      { derivedStatus: "yellow", alarmFloor: "yellow" },
      { derivedStatus: "red", alarmFloor: "red" },
      { derivedStatus: "red", alarmFloor: "red" },
    ],
    [
      { derivedStatus: "yellow", alarmFloor: null },
      { derivedStatus: "yellow", alarmFloor: "yellow" },
      { derivedStatus: "red", alarmFloor: "red" },
      { derivedStatus: "red", alarmFloor: "red" },
    ],
    [
      { derivedStatus: "red", alarmFloor: null },
      { derivedStatus: "red", alarmFloor: "yellow" },
      { derivedStatus: "red", alarmFloor: "red" },
      { derivedStatus: "red", alarmFloor: "red" },
    ],
    [
      { derivedStatus: null, alarmFloor: null },
      { derivedStatus: "yellow", alarmFloor: "yellow" },
      { derivedStatus: "red", alarmFloor: "red" },
      { derivedStatus: "red", alarmFloor: "red" },
    ],
  ];

  const cases = storedStatuses.flatMap((stored, storedIndex) =>
    riskSets.map((riskSet, riskIndex) => ({
      stored,
      riskLabel: riskSet.label,
      risks: riskSet.risks,
      expected: expected[storedIndex]?.[riskIndex],
    })),
  );

  it.each(cases)(
    "stored=$stored risks=$riskLabel",
    ({ stored, risks, expected: expectedResult }) => {
      expect(deriveActivityStatus(stored, risks)).toEqual(expectedResult);
    },
  );
});
