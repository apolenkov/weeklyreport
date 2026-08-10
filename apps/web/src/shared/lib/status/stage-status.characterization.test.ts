import type { CanonicalStatus, RiskSeverity } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { deriveEffectiveStageStatus } from "./stage-status";

type Grid = CanonicalStatus;

const PRECEDENCE: Record<Grid, number> = {
  empty: 0,
  "on-track": 1,
  "at-risk": 2,
  blocked: 3,
};

// Independent restatement of the rule (not a call into the SUT): worst covering
// severity wins; orphaned manual at-risk/blocked collapses to on-track.
function expectedStatus(
  explicit: Grid,
  risks: readonly { severity: RiskSeverity }[],
  items: readonly { workflowStatus: string }[],
): Grid {
  const candidates: Grid[] = [
    ...risks.map<Grid>((r) =>
      r.severity === "blocked" ? "blocked" : "at-risk",
    ),
    ...(items.some((i) => i.workflowStatus === "blocked")
      ? (["blocked"] as const)
      : []),
  ];
  const best = candidates.reduce<Grid>(
    (worst, candidate) =>
      PRECEDENCE[candidate] > PRECEDENCE[worst] ? candidate : worst,
    "empty",
  );
  if (best !== "empty") return best;
  return explicit === "empty" ? "empty" : "on-track";
}

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
  }[] = [
    { label: "no risks", risks: [] },
    { label: "one at-risk", risks: [{ severity: "at-risk" }] },
    { label: "one blocked", risks: [{ severity: "blocked" }] },
    {
      label: "at-risk + blocked",
      risks: [{ severity: "at-risk" }, { severity: "blocked" }],
    },
  ];
  const itemSets: {
    readonly label: string;
    readonly items: readonly { workflowStatus: string }[];
  }[] = [
    { label: "no items", items: [] },
    { label: "in-progress item", items: [{ workflowStatus: "in_progress" }] },
    { label: "blocked item", items: [{ workflowStatus: "blocked" }] },
  ];

  const cases = explicitStatuses.flatMap((explicit) =>
    riskSets.flatMap((riskSet) =>
      itemSets.map((itemSet) => ({
        explicit,
        riskLabel: riskSet.label,
        risks: riskSet.risks,
        itemLabel: itemSet.label,
        items: itemSet.items,
      })),
    ),
  );

  it.each(cases)(
    "explicit=$explicit risks=$riskLabel items=$itemLabel",
    ({ explicit, risks, items }) => {
      expect(deriveEffectiveStageStatus(explicit, risks, items)).toBe(
        expectedStatus(explicit, risks, items),
      );
    },
  );

  it("collapse-down: manual at-risk/blocked with no backing risk or item collapses to on-track", () => {
    expect(deriveEffectiveStageStatus("at-risk", [], [])).toBe("on-track");
    expect(deriveEffectiveStageStatus("blocked", [], [])).toBe("on-track");
  });

  it("collapse-down does not apply to empty (stays empty)", () => {
    expect(deriveEffectiveStageStatus("empty", [], [])).toBe("empty");
  });
});
