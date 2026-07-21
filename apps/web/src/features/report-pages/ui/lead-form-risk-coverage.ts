import { deriveEffectiveStageStatus } from "../../../lib/stage-status";
import {
  type Product,
  riskCoversStage,
  type RiskEntry,
} from "../../report-sections";

/**
 * Own non-empty risks of `productId` that cover `stageName`
 * (unify-risk-stage-status: coverage uses the canonical `riskCoversStage`
 * predicate — same as `computeUnbackedStages`). Exported for unit testing.
 */
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

/**
 * Render-time severity floor for the live lead form. Every "mine" stage is
 * routed through `deriveEffectiveStageStatus` — the same rule `mapLeadProducts`
 * applies in the read model, so the live form, head review, and export agree.
 *
 * simplify-stage-status-interaction (D3, council find C): the derivation runs
 * UNCONDITIONALLY, not only for stages with a covering risk. A covering risk
 * floors the chip UP to its severity; a stage whose raw status is at-risk/blocked
 * but has NO covering risk collapses DOWN to on-track — matching the read model,
 * which already collapses it. This is also the migration for legacy explicit
 * at-risk/blocked stage rows: they render On Track on next load, no backfill.
 * Exported for unit testing.
 */
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

/**
 * Render-time twin of the mapper's
 * `coveredByOwnRisk` annotation. `ctx.products` is stable across an in-session
 * risk add (no refetch), so the mapper-baked flag goes stale the moment the lead
 * stages a risk; re-deriving it here from the live `risks` lets the completeness
 * counter tick without a reload. Strict, like the mapper: only an OWN non-empty
 * risk that EXPLICITLY names the stage (non-empty stageIds) sets the flag — a
 * covers-all (`[]`) or legacy stage-less risk does not, so it never inflates the
 * counter. Foreign risks (other productId) never set it. Exported for testing.
 */
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
          Array.isArray(r.stageIds) &&
          r.stageIds.length > 0 &&
          riskCoversStage(r, stage.stageName),
      );
      return stage.coveredByOwnRisk === covered
        ? stage
        : { ...stage, coveredByOwnRisk: covered };
    }),
  }));
}
