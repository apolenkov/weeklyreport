import { useMemo, useState } from "react";

import type {
  ParentActivityOption,
  Product,
  RecordParent,
  RiskEntry,
} from "../../report-sections";
import {
  computeEffectiveStageNames,
  isZeroOwnedStageDeadEnd,
  resolveInitialStageNames,
  resolveRecordParent,
  useDraftStageMemory,
} from "../../report-sections";
import {
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
  readonly defaultProductId?: string | undefined;
  readonly defaultActivityId?: string | undefined;
  readonly initialStageNames?: readonly string[] | undefined;
  readonly initialSeverity?: RiskSeverity | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
}

// All four seeds are computed once on mount and stay sticky: re-deriving them
// from the current parent would overwrite what the user has already typed.
function useRiskEditSeeds(args: UseRiskEditParentStageArgs) {
  const { risk, isCreate, products, activities, stagesForProduct } = args;
  const seedProduct = isCreate
    ? args.defaultProductId
      ? products.find((p) => p.id === args.defaultProductId)
      : products[0]
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
  const seedParent = resolveRecordParent(
    risk ?? {},
    {
      productId: isCreate
        ? args.defaultProductId || seedProduct?.id
        : seedProduct?.id,
      activityId: isCreate ? args.defaultActivityId : undefined,
    },
    activities,
    products,
  );
  const [parent, setParent] = useState<RecordParent>(seedParent);

  // Edit restores saved stages; create starts from an explicit chip-raise
  // prefill, the open draft's remembered stage for this product, or the sole
  // owned stage. preCheckedStages stays info only.
  const stageMemory = useDraftStageMemory();
  const seedProductId =
    seedParent.kind === "product" ? seedParent.id : undefined;
  const [stageNames, setStageNames] = useState<string[]>(() => [
    ...resolveInitialStageNames({
      isCreate,
      storedStageNames: risk?.stageNames,
      explicitStageNames: args.initialStageNames,
      rememberedStageName:
        isCreate && seedProductId !== undefined
          ? stageMemory?.recall(seedProductId)
          : undefined,
      availableStages:
        seedProductId === undefined
          ? []
          : (stagesForProduct?.(seedProductId) ?? []),
    }),
  ]);
  const [parentError, setParentError] = useState<string | undefined>(undefined);
  const [stageError, setStageError] = useState<string | undefined>(undefined);

  return {
    severity,
    setSeverity,
    parent,
    setParent,
    stageNames,
    setStageNames,
    parentError,
    setParentError,
    stageError,
    setStageError,
  };
}

interface RiskParentDerivationArgs {
  readonly parent: RecordParent;
  readonly isActivityParent: boolean;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly stageNames: readonly string[];
  readonly risk: RiskEntry | null;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
}

// Tracks the selected parent (not the mount-time seed) so the stage strip and
// the header name follow the user's current choice.
function useRiskParentDerivations({
  parent,
  isActivityParent,
  products,
  activities,
  stageNames,
  risk,
  stagesForProduct,
}: RiskParentDerivationArgs) {
  const parentId = parent.kind === "unresolved" ? undefined : parent.id;
  const parentProduct = parentId
    ? products.find((p) => p.id === parentId)
    : undefined;
  const preCheckedStages = useMemo(
    () =>
      computePreCheckedStages(
        parentProduct,
        parentId ? (stagesForProduct?.(parentId) ?? []) : [],
      ),
    [parentProduct, parentId, stagesForProduct],
  );

  // Activities own no SDLC stage — no stages and no dead-end.
  const availableStages = isActivityParent
    ? []
    : parentId
      ? (stagesForProduct?.(parentId) ?? [])
      : [];
  const effectiveStageNames = computeEffectiveStageNames(
    stageNames,
    availableStages,
  );
  const selectedActivity = parentId
    ? activities.find((a) => a.id === parentId)
    : undefined;

  return {
    preCheckedStages,
    availableStages,
    effectiveStageNames,
    isDeadEnd:
      !isActivityParent &&
      parentId !== undefined &&
      isZeroOwnedStageDeadEnd(availableStages, effectiveStageNames),
    selectedActivity,
    parentName: resolveRiskParentName({
      isActivityParent,
      selectedActivity,
      products,
      parentId: parentId ?? "",
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
    stageNames: state.stageNames,
    risk,
    stagesForProduct,
  });

  const handleStageChange = (nextStageNames: string[]) => {
    state.setStageNames(nextStageNames);
    if (nextStageNames.length > 0) state.setStageError(undefined);
  };

  const setParentAndStages = (nextParent: RecordParent) => {
    state.setParent(nextParent);
    state.setParentError(undefined);
    // Stage selection and its validation belong to the selected parent.
    state.setStageNames([]);
    state.setStageError(undefined);
  };

  return {
    severity: state.severity,
    setSeverity: state.setSeverity,
    parent: state.parent,
    stageNames: state.stageNames,
    parentError: state.parentError,
    setParentError: state.setParentError,
    stageError: state.stageError,
    setStageError: state.setStageError,
    isActivityParent,
    handleStageChange,
    setParentAndStages,
    ...derived,
  };
}
