import type { CanonicalStatus, RiskSeverity } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { deriveEffectiveStageStatus } from "./stage-status";

type Grid = CanonicalStatus;

// Independent expected outputs for the admitted manual-status contract.
const WITHOUT_RISKS: Readonly<Record<Grid, Grid>> = {
  empty: "empty",
  "on-track": "on-track",
  "at-risk": "on-track",
  blocked: "on-track",
};

describe("deriveEffectiveStageStatus — characterization grid", () => {
  const explicitStatuses: readonly Grid[] = [
    "empty",
    "on-track",
    "at-risk",
    "blocked",
  ];
  const riskSets: {
    readonly label: string;
    readonly risks: readonly { severity: RiskSeverity }[];
    readonly expectedRiskStatus: Grid | null;
  }[] = [
    { label: "no risks", risks: [], expectedRiskStatus: null },
    {
      label: "one at-risk",
      risks: [{ severity: "at-risk" }],
      expectedRiskStatus: "at-risk",
    },
    {
      label: "one blocked",
      risks: [{ severity: "blocked" }],
      expectedRiskStatus: "blocked",
    },
    {
      label: "at-risk + blocked",
      risks: [{ severity: "at-risk" }, { severity: "blocked" }],
      expectedRiskStatus: "blocked",
    },
  ];
  const cases = explicitStatuses.flatMap((explicit) =>
    riskSets.map((riskSet) => ({
      explicit,
      riskLabel: riskSet.label,
      risks: riskSet.risks,
      expected: riskSet.expectedRiskStatus ?? WITHOUT_RISKS[explicit],
    })),
  );

  it.each(cases)(
    "explicit=$explicit risks=$riskLabel",
    ({ explicit, risks, expected }) => {
      expect(deriveEffectiveStageStatus(explicit, risks)).toBe(expected);
    },
  );

  it("collapse-down: manual at-risk/blocked with no backing risk collapses to on-track", () => {
    expect(deriveEffectiveStageStatus("at-risk", [])).toBe("on-track");
    expect(deriveEffectiveStageStatus("blocked", [])).toBe("on-track");
  });

  it("collapse-down does not apply to empty (stays empty)", () => {
    expect(deriveEffectiveStageStatus("empty", [])).toBe("empty");
  });
});
