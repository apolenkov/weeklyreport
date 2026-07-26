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

// All four seeds are computed once on mount and stay sticky: re-deriving them
// from the current parent would overwrite what the user has already typed.
function useRiskEditSeeds(args: UseRiskEditParentStageArgs) {
  const { risk, isCreate, products, activities, stagesForProduct } = args;
  const seedProduct = isCreate
    ? (products.find((p) => p.id === args.defaultProductId) ?? products[0])
    : products.find((p) => p.id === risk?.productId);

  // Chip-raise initialSeverity wins over the severity derived from the
  // product's pre-flagged stages.
  const [severity, setSeverity] = useState<RiskSeverity>(() => {
    if (risk?.severity) return risk.severity;
    if (args.initialSeverity) return args.initialSeverity;
    const ownedStages = stagesForProduct?.(seedProduct?.id ?? "") ?? [];
    return deriveFromPreChecked(seedProduct, ownedStages);
  });

  // Product XOR activity; pill-raise activity beats default product seed.
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(
      risk ?? {},
      {
        productId: seedProduct?.id,
        activityId: isCreate ? args.defaultActivityId : undefined,
      },
      activities,
    ),
  );

  // Empty on create — user marks stages; preCheckedStages is info only.
  // Chip-raise initialStageIds pre-checks the clicked stage.
  const [stageIds, setStageIds] = useState<string[]>(() =>
    computeInitialStageIds(risk, args.initialStageIds),
  );
  const [stageError, setStageError] = useState<string | undefined>(undefined);

  return {
    severity,
    setSeverity,
    parent,
    setParent,
    stageIds,
    setStageIds,
    stageError,
    setStageError,
  };
}

interface RiskParentDerivationArgs {
  readonly parent: RecordParent;
  readonly isActivityParent: boolean;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly stageIds: readonly string[];
  readonly risk: RiskEntry | null;
  readonly stagesForProduct?: (productId: string) => readonly string[];
}

// Tracks the selected parent (not the mount-time seed) so the stage strip and
// the header name follow the user's current choice.
function useRiskParentDerivations({
  parent,
  isActivityParent,
  products,
  activities,
  stageIds,
  risk,
  stagesForProduct,
}: RiskParentDerivationArgs) {
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
  const selectedActivity = activities.find((a) => a.id === parent.id);

  return {
    preCheckedStages,
    availableStages,
    effectiveStageIds,
    isDeadEnd:
      !isActivityParent &&
      isZeroOwnedStageDeadEnd(availableStages, effectiveStageIds),
    selectedActivity,
    parentName: resolveRiskParentName({
      isActivityParent,
      selectedActivity,
      products,
      parentId: parent.id,
      risk,
    }),
  };
}

export function useRiskEditParentStage(args: UseRiskEditParentStageArgs) {
  const { risk, products, activities, stagesForProduct } = args;
  const state = useRiskEditSeeds(args);
  const isActivityParent = state.parent.kind === "activity";
  const derived = useRiskParentDerivations({
    parent: state.parent,
    isActivityParent,
    products,
    activities,
    stageIds: state.stageIds,
    risk,
    stagesForProduct,
  });

  const handleStageChange = (nextStageIds: string[]) => {
    state.setStageIds(nextStageIds);
    if (nextStageIds.length > 0) state.setStageError(undefined);
  };

  const setParentAndStages = (nextParent: RecordParent) => {
    state.setParent(nextParent);
    // Never default to all owned stages — that caused inflated completeness.
    state.setStageIds([]);
  };

  return {
    severity: state.severity,
    setSeverity: state.setSeverity,
    parent: state.parent,
    stageIds: state.stageIds,
    stageError: state.stageError,
    setStageError: state.setStageError,
    isActivityParent,
    handleStageChange,
    setParentAndStages,
    ...derived,
  };
}
