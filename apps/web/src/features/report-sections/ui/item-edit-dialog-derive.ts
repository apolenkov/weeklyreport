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

// Pure form derivation — no hooks, unit-testable without React.
export function deriveItemEditFields(
  args: DeriveItemEditFieldsArgs,
): ItemEditDerivedFields {
  const isActivityParent = args.parent.kind === "activity";
  const parentId =
    args.parent.kind === "unresolved" ? undefined : args.parent.id;
  const selectedActivity = parentId
    ? args.activities.find((a) => a.id === parentId)
    : undefined;
  const selectedProduct = parentId
    ? args.products.find((p) => p.id === parentId)
    : undefined;
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
    : parentId
      ? (args.stagesForProduct?.(parentId) ?? [])
      : [];
  const effectiveStageNames = computeEffectiveStageNames(
    args.stageNames,
    availableStages,
  );
  const isDeadEnd =
    !isActivityParent &&
    isZeroOwnedStageDeadEnd(availableStages, effectiveStageNames);

  const statusSlot = resolveStatusSlot({
    isActivityParent,
    productId: isActivityParent ? null : parentId,
    stageNames: effectiveStageNames,
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
    effectiveStageNames,
    isDeadEnd,
    statusSlot,
    takenRanks,
    rankOptions,
  };
}
