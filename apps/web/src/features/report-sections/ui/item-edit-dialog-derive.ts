import {
  computeEffectiveStageIds,
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
  readonly stageIds: readonly string[];
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly ownPeriodRanks?: readonly number[];
  readonly status: ItemStatus;
  readonly risks?: readonly RiskEntry[];
}

interface ItemEditDerivedFields {
  readonly isActivityParent: boolean;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly parentName: string;
  readonly headerVerb: string;
  readonly availableStages: readonly string[];
  readonly effectiveStageIds: readonly string[];
  readonly isDeadEnd: boolean;
  readonly statusSlot: StatusSlot;
  readonly takenRanks: ReadonlySet<number>;
  readonly rankOptions: number[];
}

// Pure form derivation — no hooks, unit-testable without React.
export function deriveItemEditFields(
  args: DeriveItemEditFieldsArgs,
): ItemEditDerivedFields {
  const isActivityParent = args.parent.kind === "activity";
  const selectedActivity = args.activities.find((a) => a.id === args.parent.id);
  const selectedProduct = args.products.find((p) => p.id === args.parent.id);
  const parentName = resolveItemParentName({
    isActivityParent,
    selectedActivity,
    selectedProduct,
    initial: args.initial,
  });
  const headerVerb = args.isCreate ? "Add Item" : "Edit Item";

  // Product parents need a stage when owned stages exist; activity parents have none.
  const availableStages = isActivityParent
    ? []
    : (args.stagesForProduct?.(args.parent.id) ?? []);
  const effectiveStageIds = computeEffectiveStageIds(
    args.stageIds,
    availableStages,
  );
  const isDeadEnd =
    !isActivityParent &&
    isZeroOwnedStageDeadEnd(availableStages, effectiveStageIds);

  const statusSlot = resolveStatusSlot({
    isActivityParent,
    productId: args.parent.id,
    stageIds: effectiveStageIds,
    status: args.status,
    risks: args.risks,
  });

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
    isActivityParent,
    selectedActivity,
    parentName,
    headerVerb,
    availableStages,
    effectiveStageIds,
    isDeadEnd,
    statusSlot,
    takenRanks,
    rankOptions,
  };
}
