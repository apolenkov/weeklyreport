"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shared open/create/edit/close + add-signal guard for lead list sections.
// Section-specific prefill/seed stays at the call site (lead-dialog-lifecycle).
export type EditableListDialogState<TEntity> =
  | { open: false }
  | {
      open: true;
      mode: "create";
      seedProductId?: string;
      seedActivityId?: string;
    }
  | { open: true; mode: "edit"; entity: TEntity };

/** Create-mode parent preset (XOR): a product column's or an activity lane's "+ Add". */
export interface CreateSeed {
  readonly productId?: string;
  readonly activityId?: string;
}

interface UseEditableListDialogOptions {
  readonly readOnly: boolean;
  /** External "+ Add" counter; 0 = idle. Each increment opens create mode. */
  readonly addSignal: number;
  /**
   * Seed product for signal-opened create mode. Stays in the effect deps —
   * canonical across all four section copies.
   */
  readonly seedProductId?: string;
  /**
   * current/next-week require a seed product to open from the signal (the
   * created item must attach to a product column); risks/decisions do not.
   */
  readonly requireSeed?: boolean;
}

interface UseEditableListDialogResult<TEntity> {
  readonly dialogState: EditableListDialogState<TEntity>;
  /**
   * openSeq-derived remount key. Repeated opens of the same entity always
   * remount the dialog with fresh state.
   */
  readonly dialogKey: string;
  /** Opens create mode, optionally preselecting a parent. No-op when readOnly. */
  readonly openCreate: (seed?: CreateSeed) => void;
  /** Opens edit mode for an entity. No-op when readOnly. */
  readonly openEdit: (entity: TEntity) => void;
  /** Closes the dialog. */
  readonly close: () => void;
  readonly pendingDelete: TEntity | null;
  /** Stages an entity for delete confirmation. No-op when readOnly. */
  readonly requestDelete: (entity: TEntity) => void;
  readonly clearPendingDelete: () => void;
}

/** Sentinel meaning the add-signal effect has not yet handled any signal. */
const NO_SIGNAL_HANDLED = 0;

export function useEditableListDialog<TEntity extends { id: string }>({
  readOnly,
  addSignal,
  seedProductId,
  requireSeed = false,
}: UseEditableListDialogOptions): UseEditableListDialogResult<TEntity> {
  const [dialogState, setDialogState] = useState<
    EditableListDialogState<TEntity>
  >({ open: false });
  // Monotonic counter so repeated opens of the same entity get a fresh key
  // even when entity.id is unchanged (prevents stale state in the dialog).
  const [openSeq, setOpenSeq] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<TEntity | null>(null);

  // Read via ref so addSignal effect omits readOnly from deps (snapshot enter
  // would re-open from a stale counter). Do not move this write into an effect.
  const readOnlyRef = useRef(readOnly);
  // eslint-disable-next-line react-hooks/refs -- deliberate render-time ref stamp (see comment above): an effect-sync would re-open the dialog from a stale addSignal
  readOnlyRef.current = readOnly;

  // Seed from mount-time addSignal, not 0: slides/edit remounts while LeadForm
  // keeps a stale non-zero counter; only a later increment should open create.
  // See lead-dialog-lifecycle.
  const lastHandledSignal = useRef(addSignal);

  // Identity-stable across readOnly so chip-raise can list it without reopening on snapshot.
  const openCreate = useCallback((seed?: CreateSeed) => {
    if (readOnlyRef.current) return;
    setOpenSeq((n) => n + 1);
    setDialogState({
      open: true,
      mode: "create",
      seedProductId: seed?.productId,
      seedActivityId: seed?.activityId,
    });
  }, []);

  const openEdit = useCallback((entity: TEntity) => {
    if (readOnlyRef.current) return;
    setOpenSeq((n) => n + 1);
    setDialogState({ open: true, mode: "edit", entity });
  }, []);

  const close = useCallback(() => {
    setDialogState({ open: false });
  }, []);

  const requestDelete = useCallback((entity: TEntity) => {
    if (readOnlyRef.current) return;
    setPendingDelete(entity);
  }, []);

  const clearPendingDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  useEffect(() => {
    if (addSignal === NO_SIGNAL_HANDLED) return;
    if (addSignal <= lastHandledSignal.current) return;
    if (readOnlyRef.current) return;
    if (requireSeed && !seedProductId) return;
    lastHandledSignal.current = addSignal;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consumes the addSignal SIGNAL prop (an event delivered via props) with ref-based once-guards; state updates are the event's handler
    setOpenSeq((n) => n + 1);
    setDialogState({ open: true, mode: "create", seedProductId });
  }, [addSignal, seedProductId, requireSeed]);

  const dialogKey = `${openSeq}-${
    dialogState.open && dialogState.mode === "edit"
      ? dialogState.entity.id
      : "new"
  }`;

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
