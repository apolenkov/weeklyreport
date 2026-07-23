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

/**
 * The risk dialog's classification half: parent (product/activity), stage
 * selection, and severity state, plus the values derived from them
 * (available/effective stages, dead-end, the pre-checked context strip, and
 * the parent's display name).
 */
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

  // Severity derived ONCE from pipeline on create; user choice is sticky thereafter.
  // Severity is NOT re-derived when the user toggles stage checkboxes.
  // A chip-raise prefill (initialSeverity) wins over the derived default.
  const [severity, setSeverity] = useState<RiskSeverity>(() => {
    if (risk?.severity) return risk.severity;
    if (initialSeverity) return initialSeverity;
    const ownedStages = stagesForProduct?.(seedProduct?.id ?? "") ?? [];
    return deriveFromPreChecked(seedProduct, ownedStages);
  });

  // The record's parent — a product OR an attached activity (XOR). Seeded
  // from the bound risk on edit, else the create-mode seed — a pill raise's
  // activity beats the default product (shared seed rule; falls back to the
  // first activity for an activity-only lead).
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

  // Stage checkboxes start empty on create. The user marks stages explicitly.
  // preCheckedStages still renders an info strip (context only), but does not
  // influence initial selection. A chip-raise prefill (initialStageIds)
  // pre-checks the clicked stage.
  const [stageIds, setStageIds] = useState<string[]>(() =>
    computeInitialStageIds(risk, initialStageIds),
  );
  const [stageError, setStageError] = useState<string | undefined>(undefined);

  function handleStageChange(nextStageIds: string[]) {
    setStageIds(nextStageIds);
    // Clear stageIds error as soon as the user selects something.
    if (nextStageIds.length > 0) {
      setStageError(undefined);
    }
    // Severity is NOT updated here — user's explicit severity choice is sticky.
  }

  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    // Clear the stage selection on any parent switch. NEVER default to all
    // owned stages — that "covers all" default is the root cause of the
    // inflated-completeness ("6/7") defect. Switching to an activity hides
    // the stage step; the lead marks product stages explicitly; the
    // single-owned-stage convenience lives in handleSave.
    setStageIds([]);
  }

  // The context strip tracks the currently selected parent, exactly like the
  // editable stage list below — a mount-time snapshot would attribute the
  // seed product's flagged stages to a newly selected product, because the
  // banner's product name follows `parent`.
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

  // The stage step is product-only. An activity owns no SDLC stage
  // (Decision 5), so no stages are available and no dead-end applies.
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
