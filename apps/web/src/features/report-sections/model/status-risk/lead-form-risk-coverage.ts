import { deriveEffectiveStageStatus } from "../../../../shared/lib/status/stage-status";
import { riskCoversStage } from "../stage-tags";
import type { Product, RiskEntry } from "../types";

// Own non-empty risks whose selected stages cover this stage.
export function coveringRisksForStage(
  risks: readonly RiskEntry[],
  productId: string,
  stageName: string,
): RiskEntry[] {
  return risks.filter(
    (r) =>
      r.productId === productId &&
      r.text.trim().length > 0 &&
      riskCoversStage(r, stageName),
  );
}

// Unconditional derivation: covering risk floors UP; bare at-risk/blocked
// without a covering risk collapses DOWN to on-track (matches read model).
export function applyRiskSeverityFloor(
  products: readonly Product[],
  risks: readonly RiskEntry[],
): Product[] {
  return products.map((product) => ({
    ...product,
    stages: product.stages.map((stage) => {
      if (stage.ownership !== "mine") return stage;
      const covering = coveringRisksForStage(
        risks,
        product.id,
        stage.stageName,
      );
      const floored = deriveEffectiveStageStatus(stage.status, covering, []);
      return floored === stage.status ? stage : { ...stage, status: floored };
    }),
  }));
}

// Re-derive coveredByOwnRisk from live risks (products stay stable mid-session).
// Only own non-empty risks that explicitly name the stage set the flag.
export function annotateOwnRiskCoverage(
  products: readonly Product[],
  risks: readonly RiskEntry[],
): Product[] {
  return products.map((product) => ({
    ...product,
    stages: product.stages.map((stage) => {
      if (stage.ownership !== "mine") return stage;
      const covered = risks.some(
        (r) =>
          r.productId === product.id &&
          r.text.trim().length > 0 &&
          Array.isArray(r.stageNames) &&
          r.stageNames.length > 0 &&
          riskCoversStage(r, stage.stageName),
      );
      return stage.coveredByOwnRisk === covered
        ? stage
        : { ...stage, coveredByOwnRisk: covered };
    }),
  }));
}
