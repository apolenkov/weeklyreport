import type { Dispatch, SetStateAction } from "react";

import type {
  DecisionEntry,
  ParentActivityOption,
  Product,
  RecordParent,
} from "../../report-sections";
import {
  computeEffectiveStageNames,
  isZeroOwnedStageDeadEnd,
  resolveRecordParent,
} from "../../report-sections";
import {
  type DecisionFieldErrors,
  resolveDecisionProductName,
} from "./decision-edit-dialog-helpers";

export interface UseDecisionEditDialogArgs {
  readonly decision: DecisionEntry | null;
  readonly defaultOwner?: string | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly products?: readonly Product[] | undefined;
  readonly activities: readonly ParentActivityOption[];
  readonly defaultProductId?: string | undefined;
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
}

export interface DecisionDialogModel {
  readonly isActivityParent: boolean;
  readonly availableStages: readonly string[];
  readonly effectiveStageNames: readonly string[];
  readonly isDeadEnd: boolean;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly selectedProduct: Product | undefined;
  readonly headerProductName: string;
}

export interface DecisionFormState {
  readonly text: string;
  readonly setText: Dispatch<SetStateAction<string>>;
  readonly impact: string;
  readonly setImpact: Dispatch<SetStateAction<string>>;
  readonly deadline: string;
  readonly setDeadline: Dispatch<SetStateAction<string>>;
  readonly parent: RecordParent;
  readonly setParent: Dispatch<SetStateAction<RecordParent>>;
  readonly stageNames: string[];
  readonly setStageNames: Dispatch<SetStateAction<string[]>>;
  readonly errors: DecisionFieldErrors;
  readonly setErrors: Dispatch<SetStateAction<DecisionFieldErrors>>;
}

// Parent is product or activity; seeded from the row (edit) or default product
// / first activity (create). Shared seed rule with item/risk dialogs.
export function initialDecisionParent(
  args: UseDecisionEditDialogArgs,
): RecordParent {
  return resolveRecordParent(
    args.decision ?? {},
    { productId: args.defaultProductId || args.products?.[0]?.id },
    args.activities,
    args.products ?? [],
  );
}

export function deriveDecisionDialogModel(
  args: UseDecisionEditDialogArgs,
  parent: RecordParent,
  stageNames: readonly string[],
): DecisionDialogModel {
  const isActivityParent = parent.kind === "activity";
  const parentId = parent.kind === "unresolved" ? undefined : parent.id;
  // Product parents need a concrete stage when the lead owns any; one owned
  // stage auto-selects; zero is a dead end. Activity parents hide stage UI.
  const availableStages = isActivityParent
    ? []
    : parentId
      ? (args.stagesForProduct?.(parentId) ?? [])
      : [];
  const effectiveStageNames = computeEffectiveStageNames(
    stageNames,
    availableStages,
  );
  const selectedProduct = parentId
    ? args.products?.find((p) => p.id === parentId)
    : undefined;
  return {
    isActivityParent,
    availableStages,
    effectiveStageNames,
    isDeadEnd:
      !isActivityParent &&
      isZeroOwnedStageDeadEnd(availableStages, effectiveStageNames),
    selectedActivity: parentId
      ? args.activities.find((a) => a.id === parentId)
      : undefined,
    selectedProduct,
    headerProductName: resolveDecisionProductName(
      selectedProduct,
      args.decision,
    ),
  };
}
