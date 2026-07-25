import { useRef, useState } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { resolveRecordParent } from "../model/record-parent";
import type { ItemStatus, KanbanItem, Product } from "../model/types";
import {
  coerceInitialStatus,
  resolveInitialItem,
} from "./item-edit-dialog-helpers";
import type { ParentActivityOption, RecordParent } from "./parent-picker";

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

// Mount-seeded form state + focus trap. Parent remounts on reopen — no useEffect reset.
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
  // Legacy blocked coerces to in-progress so re-save never persists bare blocked.
  const [status, setStatus] = useState<ItemStatus>(
    coerceInitialStatus(initial.status),
  );
  // Seed from bound row so edit preserves pause reason; required only while Paused.
  const [pausedReason, setPausedReason] = useState(item?.pausedReason ?? "");
  // XOR parent; activity-lane create presets activity over seed product.
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
  // Create starts with no stage (explicit choice); edit restores saved stages.
  // Single-owned-stage auto-apply still runs at save.
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
