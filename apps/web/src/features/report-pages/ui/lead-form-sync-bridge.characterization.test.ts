import { describe, expect, it } from "vitest";

import type { Product, RiskEntry } from "../../report-sections";
import { applyRiskSeverityFloor } from "./lead-form-risk-coverage";

// Frozen severity × status grid for applyRiskSeverityFloor.
function makeProduct(
  status: Product["stages"][number]["status"],
  ownership: Product["stages"][number]["ownership"] = "mine",
): Product {
  return {
    id: "crm",
    name: "CRM Platform",
    overallStatus: "on-track",
    stages: [
      { stageName: "Dev", status, ownership, assignee: "Lead" },
      {
        stageName: "Testing",
        status: "on-track",
        ownership: "locked",
        assignee: "Other",
      },
    ],
  };
}

function makeRisk(
  overrides: Partial<RiskEntry> & { severity: RiskEntry["severity"] },
): RiskEntry {
  return {
    id: "r1",
    productId: "crm",
    productName: "CRM Platform",
    stageIds: ["Dev"],
    text: "risk",
    impact: "",
    mitigation: "",
    ...overrides,
  };
}

describe("applyRiskSeverityFloor — characterization grid", () => {
  const explicitStatuses: readonly Product["stages"][number]["status"][] = [
    "empty",
    "on-track",
    "at-risk",
    "blocked",
  ];

  it.each(explicitStatuses)(
    "no covering risk: explicit=%s collapses per deriveEffectiveStageStatus",
    (status) => {
      const result = applyRiskSeverityFloor([makeProduct(status)], []);
      const expected = status === "empty" ? "empty" : "on-track";
      expect(result[0]?.stages[0]?.status).toBe(expected);
    },
  );

  it.each(explicitStatuses)(
    "covering at-risk risk floors explicit=%s to at-risk (severity derives from the risk, not the explicit value)",
    (status) => {
      const result = applyRiskSeverityFloor(
        [makeProduct(status)],
        [makeRisk({ severity: "at-risk" })],
      );
      expect(result[0]?.stages[0]?.status).toBe("at-risk");
    },
  );

  it.each(explicitStatuses)(
    "covering blocked risk floors explicit=%s to blocked",
    (status) => {
      const result = applyRiskSeverityFloor(
        [makeProduct(status)],
        [makeRisk({ severity: "blocked" })],
      );
      expect(result[0]?.stages[0]?.status).toBe("blocked");
    },
  );

  it("a non-covering risk (different stage) does not floor the chip", () => {
    const result = applyRiskSeverityFloor(
      [makeProduct("on-track")],
      [makeRisk({ severity: "blocked", stageIds: ["Testing"] })],
    );
    expect(result[0]?.stages[0]?.status).toBe("on-track");
  });

  it("a foreign risk (different productId) does not floor the chip", () => {
    const result = applyRiskSeverityFloor(
      [makeProduct("on-track")],
      [makeRisk({ severity: "blocked", productId: "other" })],
    );
    expect(result[0]?.stages[0]?.status).toBe("on-track");
  });

  it("a locked (foreign-owned) stage is never floored", () => {
    const result = applyRiskSeverityFloor(
      [makeProduct("empty", "locked")],
      [makeRisk({ severity: "blocked" })],
    );
    expect(result[0]?.stages[0]?.status).toBe("empty");
  });

  it("an empty-text risk does not count as covering", () => {
    const result = applyRiskSeverityFloor(
      [makeProduct("on-track")],
      [makeRisk({ severity: "blocked", text: "" })],
    );
    expect(result[0]?.stages[0]?.status).toBe("on-track");
  });
});
