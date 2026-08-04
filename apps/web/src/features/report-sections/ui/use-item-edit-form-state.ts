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
  text?: string | undefined;
  stageNames?: string | undefined;
  pausedReason?: string | undefined;
}

interface UseItemEditFormStateArgs {
  readonly item: KanbanItem | null;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly week: "current" | "next";
  readonly currentUserName?: string | undefined;
  readonly defaultProductId?: string | undefined;
  readonly defaultActivityId?: string | undefined;
  readonly onCancel: () => void;
}

// Create mode seeds from the REQUESTED product only — a stale or missing id
// leaves the parent explicitly unresolved so the lead picks, instead of the
// create silently binding work to an arbitrary product.
function resolveSeedProduct(
  isCreate: boolean,
  products: readonly Product[],
  defaultProductId: string | undefined,
): Product | undefined {
  if (!isCreate) return undefined;
  return products.find((p) => p.id === defaultProductId);
}

interface ItemEditFieldsArgs {
  readonly initial: KanbanItem;
  readonly item: KanbanItem | null;
  readonly activities: readonly ParentActivityOption[];
  readonly seedActivityId: string | undefined;
}

// Every editable field of the dialog, seeded once at mount.
function useItemEditFields({
  initial,
  item,
  activities,
  seedActivityId,
}: ItemEditFieldsArgs) {
  const [text, setText] = useState(initial.text);
  // Legacy blocked coerces to in-progress so re-save never persists bare blocked.
  const [status, setStatus] = useState<ItemStatus>(() =>
    coerceInitialStatus(initial.status),
  );
  // Seed from bound row so edit preserves pause reason; required only while Paused.
  const [pausedReason, setPausedReason] = useState(item?.pausedReason ?? "");
  // XOR parent; activity-lane create presets activity over seed product.
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(initial, { activityId: seedActivityId }, activities),
  );
  const [priorityRank, setPriorityRank] = useState<number | null>(
    item?.priorityRank ?? null,
  );
  // Create starts with no stage (explicit choice); edit restores saved stages.
  // Single-owned-stage auto-apply still runs at save.
  const [stageNames, setStageNames] = useState<string[]>(
    item?.stageNames ? [...item.stageNames] : [],
  );
  const [errors, setErrors] = useState<ItemEditErrors>({});

  return {
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
    stageNames,
    setStageNames,
    errors,
    setErrors,
  };
}

// Mount-seeded form state + focus trap; the parent remounts on reopen, so no
// useEffect reset is needed.
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

  const initial: KanbanItem = resolveInitialItem({
    item,
    week,
    seedProduct: resolveSeedProduct(isCreate, products, defaultProductId),
    currentUserName,
  });

  const fields = useItemEditFields({
    initial,
    item,
    activities,
    seedActivityId: isCreate ? defaultActivityId : undefined,
  });

  return { isCreate, initial, dialogSurfaceRef, ...fields };
}
