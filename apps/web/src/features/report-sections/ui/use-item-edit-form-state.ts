import { useRef, useState } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { resolveRecordParent } from "../model/record-parent";
import type { ItemStatus, KanbanItem, Product } from "../model/types";
import {
  coerceInitialStatus,
  resolveInitialItem,
} from "./item-edit-dialog-helpers";
import type { ParentActivityOption, RecordParent } from "./product-picker";

export interface ItemEditErrors {
  text?: string;
  stageIds?: string;
  pausedReason?: string;
}

interface UseItemEditFormStateArgs {
  readonly item: KanbanItem | null;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly week: "current" | "next";
  readonly currentUserName?: string;
  readonly defaultProductId?: string;
  readonly defaultActivityId?: string;
  readonly onCancel: () => void;
}

/**
 * Raw form state + mount-time seeding + the dialog's focus trap. Split out of
 * `useItemEditDialog` so state/seeding, pure derivation
 * (`item-edit-dialog-derive`), and the save/keydown handlers
 * (`use-item-edit-save`) each stay independently readable.
 *
 * State is initialised once at mount from the bound item (or create-mode
 * defaults). The parent unmounts this component on close and mounts a fresh
 * instance on reopen, so state is always in sync with the current item — no
 * useEffect reset required.
 */
export function useItemEditFormState({
  item,
  products,
  activities,
  week,
  currentUserName,
  defaultProductId,
  defaultActivityId,
  onCancel,
}: UseItemEditFormStateArgs) {
  const isCreate = item === null;

  // Escape + focus trap via the shared primitive; the surface autofocuses its
  // first field, and the primitive restores focus to the opener on close.
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);
  useDialogFocus({
    open: true,
    onClose: onCancel,
    containerRef: dialogSurfaceRef,
  });

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
  const [errors, setErrors] = useState<ItemEditErrors>({});

  return {
    isCreate,
    initial,
    dialogSurfaceRef,
    text,
    setText,
    status,
    setStatus,
    pausedReason,
    setPausedReason,
    parent,
    setParent,
    priorityRank,
    setPriorityRank,
    stageIds,
    setStageIds,
    errors,
    setErrors,
  };
}
