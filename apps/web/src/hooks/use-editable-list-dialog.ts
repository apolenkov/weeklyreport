"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared dialog lifecycle for editable lead report sections (current week,
 * next week, risks, decisions). Extracted so the readOnly-ref add-signal
 * guard and the openSeq remount key live in exactly one place instead of
 * being hand-copied per section.
 *
 * Owns: the dialog open/create/edit/close state, the add-signal create
 * effect with readOnly-ref semantics, openSeq keying, and pending-delete
 * confirmation. Section-specific behavior (`wasEmpty`/`onRiskFilled`, the
 * risks chip-raise prefill, seed-product resolution) stays caller-side.
 */
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

  // Keep a ref so the addSignal effect can read the latest readOnly value
  // without including readOnly in the dep array. If readOnly were in deps,
  // the effect would re-fire on snapshot enter/exit and re-open the dialog
  // from a stale non-zero addSignal counter. Do NOT move the ref-write into
  // an effect-sync — that reintroduces the stale-signal reopen.
  const readOnlyRef = useRef(readOnly);
  // eslint-disable-next-line react-hooks/refs -- deliberate render-time ref stamp (see comment above): an effect-sync would re-open the dialog from a stale addSignal
  readOnlyRef.current = readOnly;

  // Close the stale-signal-vs-seed-change residual channel. The seed id stays
  // in the effect deps, so a products-list change while a stale non-zero
  // signal exists would otherwise re-open the dialog. Track the highest
  // handled signal and only open when the counter advances.
  //
  // Seed this ref from the CURRENT addSignal at mount, NOT from
  // NO_SIGNAL_HANDLED. The slides<->edit toggle conditionally renders the
  // form, so each return to edit REMOUNTS this section while the parent
  // (LeadForm) persists across the route's searchParams change — carrying a
  // stale non-zero addSignal. Seeding from 0 made the mount effect read that
  // stale counter as "advanced" and spuriously re-open the create dialog
  // (two stacked Add dialogs after Add Risk -> slides -> Add Decision ->
  // slides). Capturing the mount-time value short-circuits the effect on
  // remount, while a genuine later "+ Add" increment still advances past it
  // and opens.
  const lastHandledSignal = useRef(addSignal);

  // Identity-stable across readOnly changes (guards through readOnlyRef, not
  // the readOnly prop) so the risks chip-raise effect can list it in deps
  // without re-running on a snapshot enter/exit. Listing a [readOnly]-keyed
  // callback there would reopen the dialog on a view-state transition — the
  // exact lead-report-controls-integrity violation this hook prevents.
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
