import { describe, expect, it } from "vitest";

import type { Product, RiskEntry } from "../components/lead/mock-data";
import {
  computeCoupling,
  validateCoupling,
} from "./use-status-risk-coupling";

function makeProduct(
  id: string,
  status: Product["overallStatus"],
  name = "Product " + id,
): Product {
  return { id, name, overallStatus: status, stages: [] };
}

function makeRisk(
  id: string,
  productId: string,
  stageIds?: string[],
): RiskEntry {
  return {
    id,
    productId,
    productName: "n/a",
    severity: "at-risk",
    text: "risk",
    impact: "impact",
    mitigation: "mitigation",
    stageIds,
  };
}

describe("computeCoupling", () => {
  it("returns empty when all products are green", () => {
    const products = [
      makeProduct("p1", "on-track"),
      makeProduct("p2", "empty"),
    ];
    const risks = [makeRisk("r1", "p1")];
    expect(computeCoupling(products, risks)).toEqual([]);
  });

  it("includes at-risk product with no stage in risk row", () => {
    const products = [makeProduct("p1", "at-risk")];
    const risks = [makeRisk("r1", "p1", [])];
    const result = computeCoupling(products, risks);
    expect(result).toHaveLength(1);
    expect(result[0].riskRowsWithoutStages).toEqual(["r1"]);
  });

  it("includes blocked product with undefined stageIds", () => {
    const products = [makeProduct("p1", "blocked")];
    const risks = [makeRisk("r1", "p1")]; // no stageIds
    const result = computeCoupling(products, risks);
    expect(result[0].riskRowsWithoutStages).toEqual(["r1"]);
  });

  it("does not flag risk row that has stageIds", () => {
    const products = [makeProduct("p1", "at-risk")];
    const risks = [makeRisk("r1", "p1", ["planning"])];
    const result = computeCoupling(products, risks);
    expect(result[0].riskRowsWithoutStages).toEqual([]);
  });

  it("handles multi-stage risk row correctly", () => {
    const products = [makeProduct("p1", "blocked")];
    const risks = [makeRisk("r1", "p1", ["planning", "discovery"])];
    const result = computeCoupling(products, risks);
    expect(result[0].riskRowsWithoutStages).toEqual([]);
  });

  it("ignores risk rows for green products", () => {
    const products = [
      makeProduct("p1", "on-track"),
      makeProduct("p2", "at-risk"),
    ];
    const risks = [
      makeRisk("r1", "p1"), // green product — not counted
      makeRisk("r2", "p2", []), // red product — counted
    ];
    const result = computeCoupling(products, risks);
    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe("p2");
    expect(result[0].riskRowsWithoutStages).toEqual(["r2"]);
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
