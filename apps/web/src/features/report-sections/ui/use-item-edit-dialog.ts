import { useRef, useState } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { resolveRecordParent } from "../model/record-parent";
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
  buildActivityItemSave,
  buildProductItemSave,
  buildRankOptions,
  coerceInitialStatus,
  collectItemErrors,
  firstInvalidControl,
  resolveInitialItem,
  resolveItemParentName,
  resolveSaveProduct,
  resolveStatusSlot,
} from "./item-edit-dialog-helpers";
import type { ParentActivityOption, RecordParent } from "./product-picker";

interface UseItemEditDialogArgs {
  readonly item: KanbanItem | null;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly week: "current" | "next";
  readonly currentUserName?: string;
  readonly defaultProductId?: string;
  readonly defaultActivityId?: string;
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly ownPeriodRanks?: readonly number[];
  readonly risks?: readonly RiskEntry[];
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
}

/**
 * All state, derived values and handlers behind the item dialog's form. Kept out of the
 * component so the dialog file stays render-only.
 */
export function useItemEditDialog({
  item,
  products,
  activities,
  week,
  currentUserName,
  defaultProductId,
  defaultActivityId,
  stagesForProduct,
  ownPeriodRanks,
  risks,
  onSave,
  onCancel,
}: UseItemEditDialogArgs) {
  const isCreate = item === null;

  // Escape + focus trap via the shared primitive; the surface autofocuses its
  // first field, and the primitive restores focus to the opener on close.
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);
  useDialogFocus({
    open: true,
    onClose: onCancel,
    containerRef: dialogSurfaceRef,
  });

  // Local form state — initialised once at mount from the bound item (or
  // create-mode defaults). The parent unmounts this component on close and
  // mounts a fresh instance on reopen, so state is always in sync with the
  // current item — no useEffect reset required.
  const seedProduct = isCreate
    ? (products.find((p) => p.id === defaultProductId) ?? products[0])
    : undefined;
  const initial: KanbanItem = resolveInitialItem({
    item,
    week,
    seedProduct,
    currentUserName,
  });
  const [text, setText] = useState(initial.text);
  // record-status-derived-from-risk: a legacy stored `blocked` opens as
  // in-progress — `blocked` is no longer a free item status (the covering risk
  // owns the alarm), so re-saving never re-persists a bare `blocked`.
  const [status, setStatus] = useState<ItemStatus>(
    coerceInitialStatus(initial.status),
  );
  // require-paused-item-reason: seeded from the bound row so editing a paused
  // item preserves its reason instead of silently wiping it; required only
  // while Paused is the selected status.
  const [pausedReason, setPausedReason] = useState(item?.pausedReason ?? "");
  // activity-first-class: the record's parent — a product OR an attached
  // activity (XOR). Seeded from the bound row on edit, or from the create-mode
  // seed — an activity lane's `+ Add` presets the activity and beats the
  // baked-in seed product (falling back to the first activity for an
  // activity-only lead with no products).
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(
      initial,
      { activityId: isCreate ? defaultActivityId : undefined },
      activities,
    ),
  );
  const isActivityParent = parent.kind === "activity";
  const [priorityRank, setPriorityRank] = useState<number | null>(
    item?.priorityRank ?? null,
  );
  // unify-record-dialogs: no stage is pre-selected on create — the lead makes an
  // explicit choice (mirrors the risk dialog's no "all owned stages" default).
  // Edit restores the record's saved stages. The required-stage rule +
  // single-owned-stage auto-apply in handleSave still let a one-stage product
  // save without a click.
  const [stageIds, setStageIds] = useState<string[]>(
    item?.stageIds ? [...item.stageIds] : [],
  );
  const [errors, setErrors] = useState<{
    text?: string;
    stageIds?: string;
    pausedReason?: string;
  }>({});

  // Ranks already taken by OTHER items. The item's own current rank is
  // excluded so the user can keep it without seeing a false "taken" marker.
  // Legacy data with duplicate ranks is tolerated: the Set deduplicates.
  const takenRanks = new Set(
    (ownPeriodRanks ?? []).filter((r) => r !== (item?.priorityRank ?? null)),
  );
  // Offer options 1..10 plus any legacy rank above 10 already on the item.
  const rankOptions = buildRankOptions(item?.priorityRank ?? null);

  const selectedActivity = activities.find((a) => a.id === parent.id);
  const selectedProduct = products.find((p) => p.id === parent.id);
  const parentName = resolveItemParentName({
    isActivityParent,
    selectedActivity,
    selectedProduct,
    initial,
  });
  const headerVerb = isCreate ? "Add Item" : "Edit Item";

  // require-stage-on-items-and-decisions: a PRODUCT-parented item must carry a
  // concrete stage when the product has owned stages — mirrors the risk dialog.
  // An ACTIVITY-parented item owns no stage (Decision 5), so the stage step is
  // hidden and never validated.
  const availableStages = isActivityParent
    ? []
    : (stagesForProduct?.(parent.id) ?? []);
  const effectiveStageIds = computeEffectiveStageIds(stageIds, availableStages);
  const isDeadEnd =
    !isActivityParent &&
    isZeroOwnedStageDeadEnd(availableStages, effectiveStageIds);

  const statusSlot = resolveStatusSlot({
    isActivityParent,
    productId: parent.id,
    stageIds: effectiveStageIds,
    status,
    risks,
  });

  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    // Clear the stage selection on any parent switch — never default to all
    // owned stages (mirrors the risk dialog). Switching to an activity hides the
    // stage step; switching back to a product re-shows it empty. The
    // single-owned-stage convenience still applies at save time.
    setStageIds([]);
  }

  function handleSave() {
    // Dead-end no-op: never call onSave with an empty stageIds array, and never
    // surface the unsatisfiable "Select at least one stage." error. The
    // Ctrl/Cmd+Enter shortcut routes through here, so it inherits the guard.
    if (isDeadEnd) return;
    const trimmed = text.trim();
    const trimmedPausedReason = pausedReason.trim();
    const next: typeof errors = collectItemErrors({
      trimmed,
      isActivityParent,
      availableStages,
      effectiveStageIds,
    });
    // require-paused-item-reason: a Paused item must carry a reason.
    if (status === "paused" && trimmedPausedReason.length === 0) {
      next.pausedReason = "A reason is required to pause an item.";
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      // Move focus to the first invalid control so the error is discoverable
      // by keyboard/screen-reader users instead of leaving focus on Save.
      firstInvalidControl(next, dialogSurfaceRef.current)?.focus();
      return;
    }
    const common = {
      item,
      trimmed,
      status,
      currentUserName,
      priorityRank,
      trimmedPausedReason,
    };
    // activity-first-class: an activity parent yields an activity-parented row
    // (empty productId, no stage); a product parent keeps today's output.
    if (isActivityParent) {
      onSave(
        buildActivityItemSave({
          ...common,
          selectedActivity,
          initial,
          activityId: parent.id,
        }),
      );
      return;
    }
    const product = resolveSaveProduct(products, item, parent.id);
    if (!product) {
      setErrors({ text: "No product available" });
      return;
    }
    onSave(buildProductItemSave({ ...common, product, effectiveStageIds }));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  return {
    dialogSurfaceRef,
    headerVerb,
    parentName,
    text,
    onTextChange: (v: string) => {
      setText(v);
      setErrors((prev) => ({ ...prev, text: undefined }));
    },
    textError: errors.text,
    priorityRank,
    onPriorityRankChange: setPriorityRank,
    rankOptions,
    takenRanks,
    parent,
    onParentChange: setParentAndStages,
    isActivityParent,
    stageIds,
    availableStages,
    isDeadEnd,
    stageError: errors.stageIds,
    onStageChange: (nextStages: string[]) => {
      setStageIds(nextStages);
      setErrors((prev) => ({ ...prev, stageIds: undefined }));
    },
    statusSlot,
    status,
    onStatusSelect: setStatus,
    pausedReason,
    pausedReasonError: errors.pausedReason,
    onPausedReasonChange: (next: string) => {
      setPausedReason(next);
      setErrors((prev) => ({ ...prev, pausedReason: undefined }));
    },
    handleSave,
    handleKeyDown,
  };
}
