import type { Product, RiskEntry } from "../components/lead/mock-data";

/**
 * Coupling state for a single at-risk/blocked product.
 * Pure derived data — no side effects.
 */
export type ProductCoupling = {
  productId: string;
  productName: string;
  /** overallStatus narrowed to at-risk/blocked */
  status: "at-risk" | "blocked";
  /** IDs of risk rows for this product that have no stageIds specified */
  riskRowsWithoutStages: string[];
};

export type CouplingState = ProductCoupling[];

/**
 * For each product whose overallStatus is at-risk or blocked, returns
 * which risk rows lack explicit stage selection (stageIds empty or absent).
 *
 * Empty stageIds remains valid for green products (legacy "all stages"
 * shorthand). This invariant is only enforced for red/yellow products.
 */
export function computeCoupling(
  products: readonly Product[],
  risks: readonly RiskEntry[],
): CouplingState {
  const result: CouplingState = [];
  for (const product of products) {
    if (
      product.overallStatus !== "at-risk" &&
      product.overallStatus !== "blocked"
    ) {
      continue;
    }
    const productRisks = risks.filter((r) => r.productId === product.id);
    const riskRowsWithoutStages = productRisks
      .filter((r) => !r.stageIds || r.stageIds.length === 0)
      .map((r) => r.id);
    result.push({
      productId: product.id,
      productName: product.name,
      status: product.overallStatus as "at-risk" | "blocked",
      riskRowsWithoutStages,
    });
  }
  return result;
}

/**
 * Returns IDs of products that have at-risk/blocked status but contain
 * risk rows without explicit stage selection.
 *
 * Empty result means all coupling invariants are satisfied.
 */
export function validateCoupling(coupling: CouplingState): {
  missing: string[];
} {
  const missing = coupling
    .filter((c) => c.riskRowsWithoutStages.length > 0)
    .map((c) => c.productId);
  return { missing };
}
