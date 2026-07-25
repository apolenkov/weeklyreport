import { useMemo, useState } from "react";

import type {
  ParentActivityOption,
  Product,
  RecordParent,
  RiskEntry,
} from "../../report-sections";
import {
  computeEffectiveStageIds,
  isZeroOwnedStageDeadEnd,
  resolveRecordParent,
} from "../../report-sections";
import {
  computeInitialStageIds,
  computePreCheckedStages,
  deriveFromPreChecked,
  resolveRiskParentName,
  type RiskSeverity,
} from "./risk-edit-dialog-helpers";

interface UseRiskEditParentStageArgs {
  readonly risk: RiskEntry | null;
  readonly isCreate: boolean;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly defaultProductId?: string;
  readonly defaultActivityId?: string;
  readonly initialStageIds?: string[];
  readonly initialSeverity?: RiskSeverity;
  readonly stagesForProduct?: (productId: string) => readonly string[];
}

export function useRiskEditParentStage({
  risk,
  isCreate,
  products,
  activities,
  defaultProductId,
  defaultActivityId,
  initialStageIds,
  initialSeverity,
  stagesForProduct,
}: UseRiskEditParentStageArgs) {
  const seedProduct = isCreate
    ? (products.find((p) => p.id === defaultProductId) ?? products[0])
    : products.find((p) => p.id === risk?.productId);

  // Derived once on create; sticky thereafter (not re-run on stage toggles).
  // Chip-raise initialSeverity wins over the derived default.
  const [severity, setSeverity] = useState<RiskSeverity>(() => {
    if (risk?.severity) return risk.severity;
    if (initialSeverity) return initialSeverity;
    const ownedStages = stagesForProduct?.(seedProduct?.id ?? "") ?? [];
    return deriveFromPreChecked(seedProduct, ownedStages);
  });

  // Product XOR activity; pill-raise activity beats default product seed.
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(
      risk ?? {},
      {
        productId: seedProduct?.id,
        activityId: isCreate ? defaultActivityId : undefined,
      },
      activities,
    ),
  );
  const isActivityParent = parent.kind === "activity";

  // Empty on create — user marks stages; preCheckedStages is info only.
  // Chip-raise initialStageIds pre-checks the clicked stage.
  const [stageIds, setStageIds] = useState<string[]>(() =>
    computeInitialStageIds(risk, initialStageIds),
  );
  const [stageError, setStageError] = useState<string | undefined>(undefined);

  function handleStageChange(nextStageIds: string[]) {
    setStageIds(nextStageIds);
    if (nextStageIds.length > 0) {
      setStageError(undefined);
    }
  }

  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    // Never default to all owned stages — that caused inflated completeness.
    setStageIds([]);
  }

  // Track selected parent (not mount-time seed) so the strip's name matches.
  const parentProduct = isActivityParent
    ? undefined
    : products.find((p) => p.id === parent.id);
  const preCheckedStages = useMemo(
    () =>
      computePreCheckedStages(
        parentProduct,
        stagesForProduct?.(parentProduct?.id ?? "") ?? [],
      ),
    [parentProduct, stagesForProduct],
  );

  // Activities own no SDLC stage — no stages and no dead-end.
  const availableStages = isActivityParent
    ? []
    : (stagesForProduct?.(parent.id) ?? []);
  const effectiveStageIds = computeEffectiveStageIds(stageIds, availableStages);
  const isDeadEnd =
    !isActivityParent &&
    isZeroOwnedStageDeadEnd(availableStages, effectiveStageIds);

  const selectedActivity = activities.find((a) => a.id === parent.id);
  const parentName = resolveRiskParentName({
    isActivityParent,
    selectedActivity,
    products,
    parentId: parent.id,
    risk,
  });

  return {
    severity,
    setSeverity,
    parent,
    setParentAndStages,
    isActivityParent,
    stageIds,
    stageError,
    setStageError,
    handleStageChange,
    preCheckedStages,
    availableStages,
    effectiveStageIds,
    isDeadEnd,
    selectedActivity,
    parentName,
  };
}
