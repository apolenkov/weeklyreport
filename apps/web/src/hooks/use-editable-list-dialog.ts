"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared dialog lifecycle for editable lead report sections (current week,
 * next week, risks, decisions). Extracted so the D1 readOnly-ref add-signal
 * fix and the D13 openSeq remount key live in exactly one place instead of
 * being hand-copied per section — the duplication that once let the D1 fix
 * reach only a subset of sections.
 *
 * Owns: the dialog open/create/edit/close state, the add-signal create
 * effect with D1 readOnly-ref semantics, openSeq keying (D13), and
 * pending-delete confirmation. Section-specific behavior
 * (`wasEmpty`/`onRiskFilled`, the risks chip-raise prefill, seed-product
 * resolution) stays caller-side per `lead-dialog-lifecycle` (D3).
 */
export type EditableListDialogState<TEntity> =
  | { open: false }
  | { open: true; mode: "create"; seedProductId?: string }
  | { open: true; mode: "edit"; entity: TEntity };

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
   * openSeq-derived remount key (D13) — port of `deriveDialogProps`. Repeated
   * opens of the same entity always remount the dialog with fresh state.
   */
  readonly dialogKey: string;
  /** Opens create mode. No-op when readOnly. */
  readonly openCreate: (seedProductId?: string) => void;
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
  // D-13: monotonic counter so repeated opens of the same entity get a fresh
  // key even when entity.id is unchanged (prevents stale state in the dialog).
  const [openSeq, setOpenSeq] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<TEntity | null>(null);

  // Keep a ref so the addSignal effect can read the latest readOnly value
  // without including readOnly in the dep array. If readOnly were in deps,
  // the effect would re-fire on snapshot enter/exit and re-open the dialog
  // from a stale non-zero addSignal counter (D1 fix). Copied verbatim from
  // the donor sections — do NOT "improve" the ref-write into an effect-sync.
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  // D4: close the stale-signal-vs-seed-change residual channel. The seed id
  // stays in the effect deps (canonical), so a products-list change while a
  // stale non-zero signal exists would otherwise re-open the dialog. Track
  // the highest handled signal and only open when the counter advances.
  const lastHandledSignal = useRef(NO_SIGNAL_HANDLED);

  // Identity-stable across readOnly changes (guards through readOnlyRef, not
  // the readOnly prop) so the risks chip-raise effect can list it in deps
  // without re-running on a snapshot enter/exit. Listing a [readOnly]-keyed
  // callback there would reopen the dialog on a view-state transition — the
  // exact lead-report-controls-integrity violation this hook prevents.
  const openCreate = useCallback((nextSeedProductId?: string) => {
    if (readOnlyRef.current) return;
    setOpenSeq((n) => n + 1);
    setDialogState({
      open: true,
      mode: "create",
      seedProductId: nextSeedProductId,
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
