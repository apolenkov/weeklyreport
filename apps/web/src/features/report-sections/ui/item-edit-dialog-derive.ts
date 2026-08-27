import {
  computeEffectiveStageNames,
  isZeroOwnedStageDeadEnd,
} from "../model/stage-ownership";
import type {
  ItemStatus,
  KanbanItem,
  Product,
  RiskEntry,
} from "../model/types";
import {
  buildRankOptions,
  resolveItemParentName,
  resolveStatusSlot,
  type StatusSlot,
} from "./item-edit-dialog-helpers";
import type { ParentActivityOption, RecordParent } from "./parent-picker";

interface DeriveItemEditFieldsArgs {
  readonly isCreate: boolean;
  readonly item: KanbanItem | null;
  readonly initial: KanbanItem;
  readonly parent: RecordParent;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly stageNames: readonly string[];
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly status: ItemStatus;
  readonly risks?: readonly RiskEntry[] | undefined;
}

interface ItemEditDerivedFields {
  readonly isActivityParent: boolean;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly parentName: string;
  readonly headerVerb: string;
  readonly availableStages: readonly string[];
  readonly effectiveStageNames: readonly string[];
  readonly isDeadEnd: boolean;
  readonly statusSlot: StatusSlot;
  readonly takenRanks: ReadonlySet<number>;
  readonly rankOptions: number[];
}

interface ItemParentFields {
  readonly isActivityParent: boolean;
  readonly parentId: string | undefined;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly parentName: string;
}

function deriveItemParentFields(
  args: DeriveItemEditFieldsArgs,
): ItemParentFields {
  const isActivityParent = args.parent.kind === "activity";
  const parentId =
    args.parent.kind === "unresolved" ? undefined : args.parent.id;
  const selectedActivity = parentId
    ? args.activities.find((activity) => activity.id === parentId)
    : undefined;
  const selectedProduct = parentId
    ? args.products.find((product) => product.id === parentId)
    : undefined;
  return {
    isActivityParent,
    parentId,
    selectedActivity,
    parentName: resolveItemParentName({
      isActivityParent,
      selectedActivity,
      selectedProduct,
      initial: args.initial,
    }),
  };
}

function deriveItemStageFields(
  args: DeriveItemEditFieldsArgs,
  parent: ItemParentFields,
) {
  const availableStages = parent.isActivityParent
    ? []
    : parent.parentId
      ? (args.stagesForProduct?.(parent.parentId) ?? [])
      : [];
  const effectiveStageNames = computeEffectiveStageNames(
    args.stageNames,
    availableStages,
  );
  return {
    availableStages,
    effectiveStageNames,
    isDeadEnd:
      !parent.isActivityParent &&
      isZeroOwnedStageDeadEnd(availableStages, effectiveStageNames),
    statusSlot: resolveStatusSlot({
      isActivityParent: parent.isActivityParent,
      productId: parent.isActivityParent ? null : parent.parentId,
      stageNames: effectiveStageNames,
      status: args.status,
      risks: args.risks,
    }),
  };
}

// Pure form derivation — no hooks, unit-testable without React.
export function deriveItemEditFields(
  args: DeriveItemEditFieldsArgs,
): ItemEditDerivedFields {
  const parent = deriveItemParentFields(args);
  const stage = deriveItemStageFields(args, parent);

  // Ranks already taken by OTHER items. The item's own current rank is
  // excluded so the user can keep it without seeing a false "taken" marker.
  // Legacy data with duplicate ranks is tolerated: the Set deduplicates.
  const takenRanks = new Set(
    (args.ownPeriodRanks ?? []).filter(
      (r) => r !== (args.item?.priorityRank ?? null),
    ),
  );
  // Offer options 1..10 plus any legacy rank above 10 already on the item.
  const rankOptions = buildRankOptions(args.item?.priorityRank ?? null);

  return {
    isActivityParent: parent.isActivityParent,
    selectedActivity: parent.selectedActivity,
    parentName: parent.parentName,
    headerVerb: args.isCreate ? "Add Item" : "Edit Item",
    ...stage,
    takenRanks,
    rankOptions,
  };
}
