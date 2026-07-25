import type {
  DecisionEntry,
  ParentActivityOption,
  Product,
  RecordParent,
} from "../../report-sections";
import {
  computeEffectiveStageIds,
  isZeroOwnedStageDeadEnd,
  resolveRecordParent,
} from "../../report-sections";
import { resolveDecisionProductName } from "./decision-edit-dialog-helpers";

export interface UseDecisionEditDialogArgs {
  readonly decision: DecisionEntry | null;
  readonly defaultOwner?: string;
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly products?: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly defaultProductId?: string;
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
}

export interface DecisionDialogModel {
  readonly isActivityParent: boolean;
  readonly availableStages: readonly string[];
  readonly effectiveStageIds: readonly string[];
  readonly isDeadEnd: boolean;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly selectedProduct: Product | undefined;
  readonly headerProductName: string;
}

// Parent is product or activity; seeded from the row (edit) or default product
// / first activity (create). Shared seed rule with item/risk dialogs.
/**
 * Initial Decision Parent.
 * @param args - The args argument.
 */
export function initialDecisionParent(
  args: UseDecisionEditDialogArgs,
): RecordParent {
  return resolveRecordParent(
    args.decision ?? {},
    { productId: args.defaultProductId || args.products?.[0]?.id },
    args.activities,
  );
}

/**
 * Derive Decision Dialog Model.
 * @param args - The args argument.
 * @param parent - The parent argument.
 * @param stageIds - The stageIds argument.
 */
export function deriveDecisionDialogModel(
  args: UseDecisionEditDialogArgs,
  parent: RecordParent,
  stageIds: readonly string[],
): DecisionDialogModel {
  const isActivityParent = parent.kind === "activity";
  // Product parents need a concrete stage when the lead owns any; one owned
  // stage auto-selects; zero is a dead end. Activity parents hide stage UI.
  const availableStages = isActivityParent
    ? []
    : (args.stagesForProduct?.(parent.id) ?? []);
  const effectiveStageIds = computeEffectiveStageIds(stageIds, availableStages);
  const selectedProduct = args.products?.find((p) => p.id === parent.id);
  return {
    isActivityParent,
    availableStages,
    effectiveStageIds,
    isDeadEnd:
      !isActivityParent &&
      isZeroOwnedStageDeadEnd(availableStages, effectiveStageIds),
    selectedActivity: args.activities.find((a) => a.id === parent.id),
    selectedProduct,
    headerProductName: resolveDecisionProductName(
      selectedProduct,
      args.decision,
    ),
  };
}
