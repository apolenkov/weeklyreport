"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type {
  CreateSeed,
  EditableListDialogState,
  UseEditableListDialogResult,
} from "./editable-list-dialog.types";

interface UseEditableListDialogOptions {
  readonly readOnly: boolean;
  // External "+ Add" counter; 0 = idle. Each increment opens create mode.
  readonly addSignal: number;
  // Seed product for signal-opened create mode. Stays in the effect deps —
  // canonical across all four section copies.
  readonly seedProductId?: string | undefined;
  // Activity is the fallback parent when no product seed exists.
  readonly seedActivityId?: string | undefined;
  // current/next-week require a product or activity parent to open from the
  // signal; risks/decisions do not.
  readonly requireSeed?: boolean | undefined;
}

// Sentinel meaning the add-signal effect has not yet handled any signal.
const NO_SIGNAL_HANDLED = 0;

function createModeState<TEntity>(
  seed?: CreateSeed,
): EditableListDialogState<TEntity> {
  return {
    open: true,
    mode: "create",
    ...(seed?.productId === undefined ? {} : { seedProductId: seed.productId }),
    ...(seed?.activityId === undefined
      ? {}
      : { seedActivityId: seed.activityId }),
  };
}

function buildDialogKey<TEntity extends { id: string }>(
  openSeq: number,
  state: EditableListDialogState<TEntity>,
): string {
  const target = state.open && state.mode === "edit" ? state.entity.id : "new";
  return `${openSeq}-${target}`;
}

function usePendingDelete<TEntity>(readOnly: boolean) {
  const [pendingDelete, setPendingDelete] = useState<TEntity | null>(null);
  const requestDelete = useCallback(
    (entity: TEntity) => {
      if (readOnly) return;
      setPendingDelete(entity);
    },
    [readOnly],
  );
  const clearPendingDelete = useCallback(() => setPendingDelete(null), []);
  return { pendingDelete, requestDelete, clearPendingDelete };
}

export function useEditableListDialog<TEntity extends { id: string }>({
  readOnly,
  addSignal,
  seedProductId,
  seedActivityId,
  requireSeed = false,
}: UseEditableListDialogOptions): UseEditableListDialogResult<TEntity> {
  type DialogState = EditableListDialogState<TEntity>;
  const [dialogState, setDialogState] = useReducer(
    (_current: DialogState, next: DialogState) => next,
    { open: false },
  );
  // Monotonic counter so repeated opens of the same entity get a fresh key
  // even when entity.id is unchanged (prevents stale state in the dialog).
  const [openSeq, advanceOpenSeq] = useReducer((value: number) => value + 1, 0);

  // Seed from mount-time addSignal, not 0: slides/edit remounts while LeadForm
  // keeps a stale non-zero counter; only a later increment should open create.
  // See lead-dialog-lifecycle.
  const lastHandledSignal = useRef(addSignal);

  // The callback follows readOnly so every caller uses the current edit guard.
  const openCreate = useCallback(
    (seed?: CreateSeed) => {
      if (readOnly) return;
      advanceOpenSeq();
      setDialogState(createModeState<TEntity>(seed));
    },
    [readOnly],
  );

  const openEdit = useCallback(
    (entity: TEntity) => {
      if (readOnly) return;
      advanceOpenSeq();
      setDialogState({ open: true, mode: "edit", entity });
    },
    [readOnly],
  );

  const close = useCallback(() => setDialogState({ open: false }), []);
  const { pendingDelete, requestDelete, clearPendingDelete } =
    usePendingDelete<TEntity>(readOnly);

  useEffect(() => {
    if (addSignal === NO_SIGNAL_HANDLED) return;
    if (addSignal <= lastHandledSignal.current) return;
    if (readOnly) return;
    if (requireSeed && !seedProductId && !seedActivityId) return;
    lastHandledSignal.current = addSignal;
    advanceOpenSeq();
    setDialogState({
      open: true,
      mode: "create",
      ...(seedProductId === undefined ? {} : { seedProductId }),
      ...(seedProductId !== undefined || seedActivityId === undefined
        ? {}
        : { seedActivityId }),
    });
  }, [addSignal, readOnly, seedProductId, seedActivityId, requireSeed]);

  const dialogKey = buildDialogKey(openSeq, dialogState);

  return {
    dialogState,
    dialogKey,
    openCreate,
    openEdit,
    close,
    pendingDelete,
    requestDelete,
    clearPendingDelete,
  };
}
