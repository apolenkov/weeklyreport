import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import { committedRisks } from "../lead-submit-readiness";
import type { Product, RiskEntry } from "../types";
import { computeCoupling, validateCoupling } from "./coupling";

function makeProduct(
  id: string,
  status: Product["overallStatus"],
  name = `Product ${id}`,
  stages: Product["stages"] = [],
): Product {
  return { id, name, overallStatus: status, stages };
}

function makeRisk(
  id: string,
  productId: string,
  stageNames: string[],
): RiskEntry {
  return {
    id,
    productId,
    productName: "n/a",
    severity: "at-risk",
    text: "risk",
    impact: "impact",
    mitigation: "mitigation",
    stageNames,
  };
}

describe("computeCoupling", () => {
  it("returns empty when all products are green", () => {
    const products = [
      makeProduct("p1", "on-track"),
      makeProduct("p2", "empty"),
    ];
    const risks = [makeRisk("r1", "p1", ["Planning"])];
    expect(computeCoupling(products, risks)).toEqual([]);
  });

  it("includes at-risk product with no stage in risk row", () => {
    const products = [makeProduct("p1", "at-risk")];
    const risks = [makeRisk("r1", "p1", [])];
    const result = computeCoupling(products, risks);
    expect(result).toHaveLength(1);
    expect(expectDefined(result[0]).riskRowsWithoutStages).toEqual(["r1"]);
  });

  it("flags a blocked product risk without an explicit stage", () => {
    const products = [makeProduct("p1", "blocked")];
    const risks = [makeRisk("r1", "p1", [])];
    const result = computeCoupling(products, risks);
    expect(expectDefined(result[0]).riskRowsWithoutStages).toEqual(["r1"]);
  });

  it("does not flag risk row that has stageNames", () => {
    const products = [makeProduct("p1", "at-risk")];
    const risks = [makeRisk("r1", "p1", ["planning"])];
    const result = computeCoupling(products, risks);
    expect(expectDefined(result[0]).riskRowsWithoutStages).toEqual([]);
  });

  it("handles multi-stage risk row correctly", () => {
    const products = [makeProduct("p1", "blocked")];
    const risks = [makeRisk("r1", "p1", ["planning", "discovery"])];
    const result = computeCoupling(products, risks);
    expect(expectDefined(result[0]).riskRowsWithoutStages).toEqual([]);
  });

  it("ignores risk rows for green products", () => {
    const products = [
      makeProduct("p1", "on-track"),
      makeProduct("p2", "at-risk"),
    ];
    const risks = [
      makeRisk("r1", "p1", ["Planning"]), // green product — not counted
      makeRisk("r2", "p2", []), // red product — counted
    ];
    const result = computeCoupling(products, risks);
    expect(result).toHaveLength(1);
    const row = expectDefined(result[0]);
    expect(row.productId).toBe("p2");
    expect(row.riskRowsWithoutStages).toEqual(["r2"]);
  });

  it("does not falsely reject when staged risk exists alongside an empty row", () => {
    // Caller is responsible for filtering out uncommitted (empty text) rows
    // before passing to computeCoupling — this test verifies that once the
    // caller filters them, a staged row is not rejected.
    const products = [makeProduct("p1", "at-risk")];
    // Simulate what handleSubmit does: filter out empty rows before coupling check.
    const allRisks = [
      makeRisk("r1", "p1", ["planning"]), // filled + staged
      { ...makeRisk("r2", "p1", []), text: "", mitigation: "" }, // incomplete and stage-less, not committed
    ];
    const result = computeCoupling(products, committedRisks(allRisks));
    // Only r1 remains after filter; r1 has stageNames → no coupling violation
    expect(expectDefined(result[0]).riskRowsWithoutStages).toEqual([]);
    expect(validateCoupling(result).missing).toEqual([]);
  });
});

describe("validateCoupling", () => {
  it("returns empty missing when no coupling issues", () => {
    const coupling = [
      {
        productId: "p1",
        productName: "P1",
        status: "at-risk" as const,
        riskRowsWithoutStages: [],
      },
    ];
    expect(validateCoupling(coupling).missing).toEqual([]);
  });

  it("returns product IDs with coupling issues", () => {
    const coupling = [
      {
        productId: "p1",
        productName: "P1",
        status: "blocked" as const,
        riskRowsWithoutStages: ["r1", "r2"],
      },
      {
        productId: "p2",
        productName: "P2",
        status: "at-risk" as const,
        riskRowsWithoutStages: [],
      },
    ];
    expect(validateCoupling(coupling).missing).toEqual(["p1"]);
  });
});
