import type { Product, RiskEntry } from "../types";

interface ProductCoupling {
  productId: string;
  productName: string;
  status: "at-risk" | "blocked";
  riskRowsWithoutStages: readonly string[];
}

export type CouplingState = readonly ProductCoupling[];

// Empty stageNames is valid only for activity-parented rows; product risks are
// rejected by the write contract before they reach this projection.
export function computeCoupling(
  products: readonly Product[],
  risks: readonly RiskEntry[],
): CouplingState {
  return products.flatMap((product) => {
    if (
      product.overallStatus !== "at-risk" &&
      product.overallStatus !== "blocked"
    ) {
      return [];
    }

    return [
      {
        productId: product.id,
        productName: product.name,
        status: product.overallStatus,
        riskRowsWithoutStages: risks
          .filter(
            (risk) =>
              risk.productId === product.id && risk.stageNames.length === 0,
          )
          .map((risk) => risk.id),
      },
    ];
  });
}

export function validateCoupling(coupling: CouplingState): {
  missing: readonly string[];
} {
  const missing = coupling
    .filter((entry) => entry.riskRowsWithoutStages.length > 0)
    .map((entry) => entry.productId);
  return { missing };
}
