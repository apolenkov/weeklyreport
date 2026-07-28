import { describe, expect, it } from "vitest";

import type { Product, RiskEntry } from "../../report-sections";
import {
  annotateOwnRiskCoverage,
  coveringRisksForStage,
} from "./lead-form-risk-coverage";

// Render-time coverage pins; severity-floor grid lives in the sync-bridge char test.
function makeProduct(
  ownership: Product["stages"][number]["ownership"] = "mine",
): Product {
  return {
    id: "crm",
    name: "CRM Platform",
    overallStatus: "on-track",
    stages: [
      { stageName: "Dev", status: "on-track", ownership, assignee: "Lead" },
    ],
  } satisfies Product;
}

function makeRisk(overrides: Partial<RiskEntry> = {}): RiskEntry {
  return {
    id: "r1",
    productId: "crm",
    productName: "CRM Platform",
    stageNames: ["Dev"],
    text: "risk",
    impact: "",
    mitigation: "",
    severity: "at-risk",
    ...overrides,
  };
}

describe("coveringRisksForStage", () => {
  it("excludes empty / whitespace-only text risks", () => {
    expect(
      coveringRisksForStage([makeRisk({ text: "" })], "crm", "Dev"),
    ).toHaveLength(0);
    expect(
      coveringRisksForStage([makeRisk({ text: " ".repeat(3) })], "crm", "Dev"),
    ).toHaveLength(0);
  });

  it("excludes a risk that does not cover the stage", () => {
    expect(
      coveringRisksForStage(
        [makeRisk({ stageNames: ["Testing"] })],
        "crm",
        "Dev",
      ),
    ).toHaveLength(0);
  });

  it("includes an own, non-empty, covering risk", () => {
    expect(coveringRisksForStage([makeRisk()], "crm", "Dev")).toHaveLength(1);
  });
});

describe("annotateOwnRiskCoverage", () => {
  it("sets coveredByOwnRisk when an own risk explicitly names the stage", () => {
    const result = annotateOwnRiskCoverage([makeProduct()], [makeRisk()]);
    expect(result[0]?.stages[0]?.coveredByOwnRisk).toBe(true);
  });

  it("does NOT set the flag for a covers-all ([]) risk", () => {
    const result = annotateOwnRiskCoverage(
      [makeProduct()],
      [makeRisk({ stageNames: [] })],
    );
    expect(result[0]?.stages[0]?.coveredByOwnRisk).toBe(false);
  });

  it("does NOT set the flag for a foreign (other productId) risk", () => {
    const result = annotateOwnRiskCoverage(
      [makeProduct()],
      [makeRisk({ productId: "other" })],
    );
    expect(result[0]?.stages[0]?.coveredByOwnRisk).toBe(false);
  });

  it("does NOT set the flag for an empty-text risk", () => {
    const result = annotateOwnRiskCoverage(
      [makeProduct()],
      [makeRisk({ text: "" })],
    );
    expect(result[0]?.stages[0]?.coveredByOwnRisk).toBe(false);
  });
});
