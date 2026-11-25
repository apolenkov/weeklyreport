import type { LeadStatusOverviewOutput } from "@weeklyreport/shared";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useRef,
  useState,
} from "react";

import {
  type KanbanItem,
  type StatusOverviewModel,
} from "../../../../report-sections";
import {
  OverviewEditorDialog,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import { overviewEditorRecoveryReason } from "./overview-editor-recovery";
import { useRetainedOverviewState } from "./overview-input-provider";
import { saveOverviewItem } from "./overview-item-save";
import {
  closeOverviewDialog,
  overviewSaveFailure,
  useOverviewSubmissionDriver,
} from "./overview-item-submission";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import {
  type OverviewCreatedFocus,
  useOverviewFocusReturn,
} from "./use-overview-focus-return";
import { useOverviewMovedFocus } from "./use-overview-moved-focus";
import {
  useOverviewCreateOpeners,
  useOverviewEditOpeners,
} from "./use-overview-openers";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
export function useOverviewItemEditor(
  editor: ReadyEditor | null,
  model: StatusOverviewModel,
  reportId: string,
  output?: LeadStatusOverviewOutput,
) {
  const isReadOnly = editor?.view.viewModel.isReadOnly ?? true;
  const [dialog, setDialog] = useRetainedOverviewState("item", reportId);
  const [error, setError] = useState<string | null>(null);
  const recoveryReason = overviewEditorRecoveryReason(editor, dialog, model);
  const startedAttempt = useRef<number | null>(null);
  const promotionAttempt = useRef<string | null>(null);
  const { createdFocus, requestCloseRef, keepFocus, rememberFocus } =
    useEditorFocus(dialog !== null);
  const focusMoved = useOverviewMovedFocus();
  useOverviewSubmissionDriver({
    editor,
    dialog,
    recoveryReason,
    setDialog,
    startedAttempt,
    createdFocus,
  });
  const shared = { editor, dialog, isReadOnly, setDialog };
  const openers = {
    ...shared,
    model,
    output,
    rememberFocus,
    focusMoved,
    resetAttempt: () => {
      startedAttempt.current = null;
    },
  };
  const editOpeners = useOverviewEditOpeners(openers);
  const { addItem, planItem, changeWeek } = useOverviewCreateOpeners(openers);
  const saveContext = {
    ...shared,
    recoveryReason,
    setError,
    startedAttempt,
    promotionAttempt,
  };
  const saveAndAddAnother =
    dialog?.mode === "create"
      ? (updatedItem: KanbanItem): void =>
          saveOverviewItem(saveContext, updatedItem, { addAnother: true })
      : undefined;
  const close = () => {
    closeOverviewDialog({ editor, dialog, recoveryReason, setDialog });
    startedAttempt.current = null;
    promotionAttempt.current = null;
    setError(null);
  };
  const details = useOverviewDetails(dialog, setDialog, close);
  return {
    dialog,
    requestCloseRef,
    restoreDialog: (saved: OverviewItemDialogState) =>
      setDialog((current) => current ?? saved),
    ...details,
    error: error ?? overviewSaveFailure(editor, dialog),
    recoveryReason,
    ...editOpeners,
    addItem,
    planItem,
    changeWeek,
    save: (updatedItem: KanbanItem) =>
      saveOverviewItem(saveContext, updatedItem),
    saveAndAddAnother,
    leave: () => {
      if (dialog?.draftStore.isDirty() || dialog?.submission) return;
      keepFocus();
      setDialog(null);
      setError(null);
    },
    close,
  };
}

function useOverviewDetails(
  dialog: OverviewItemDialogState | null,
  setDialog: Dispatch<SetStateAction<OverviewItemDialogState | null>>,
  close: () => void,
) {
  const detailsOrigin = useRef<HTMLElement | null>(null);
  const detailsBaseline = useRef<string | null>(null);
  const detailsFields = () =>
    JSON.stringify([dialog?.week, dialog?.draftStore.getSnapshot()]);
  const canReturnFromDetails = () =>
    dialog?.detailsOpen === true &&
    dialog.submission === null &&
    detailsFields() === detailsBaseline.current;
  const dismissDetails = () => {
    if (!canReturnFromDetails()) {
      close();
      return;
    }
    setDialog((current) =>
      current ? { ...current, detailsOpen: false } : null,
    );
  };
  return {
    showDetails: (origin: HTMLElement) => {
      detailsOrigin.current = origin;
      detailsBaseline.current = detailsFields();
      setDialog((current) =>
        current ? { ...current, detailsOpen: true } : null,
      );
    },
    dismissDetails,
    canReturnFromDetails,
    restoreDetailsFocus: () => {
      const origin = detailsOrigin.current;
      detailsOrigin.current = null;
      if (origin?.isConnected) origin.focus();
    },
  };
}

export function buildOverviewEditor(
  editor: ReadyEditor | null,
  editing: OverviewItemDialogState | null,
  {
    onSave,
    onSaveAndAddAnother,
    onCancel,
    closeWithoutConfirmation,
    onWeekChange,
    requestCloseRef,
  }: {
    onSave: (item: KanbanItem) => void;
    onSaveAndAddAnother?: ((item: KanbanItem) => void) | undefined;
    onCancel: () => void;
    closeWithoutConfirmation?: (() => boolean) | undefined;
    onWeekChange: (week: "current" | "next") => void;
    requestCloseRef: RefObject<(() => void) | null>;
  },
) {
  if (!editor || !editing || editor.view.viewModel.isReadOnly) return undefined;
  if (editing.generation !== editor.generation) return undefined;
  const parent =
    editing.mode === "create"
      ? { kind: editing.target.unitKind, id: editing.target.unitId }
      : (editing.submission?.item.parent ?? editing.item.parent);
  if (parent.kind === "unresolved") return undefined;
  return (
    <OverviewEditorDialog
      editor={editor}
      dialog={editing}
      isReadOnly={false}
      saveDisabled={
        editing.submission?.discard != null ||
        (editing.mode === "edit" && editing.promotion?.pending === true) ||
        (editing.submission !== null &&
          editor.draft.autosave.state !== "error" &&
          (editor.draft.autosave.dirty ||
            editor.draft.autosave.isInFlight ||
            editor.draft.autosave.state === "pending" ||
            editor.draft.autosave.state === "saving"))
      }
      onSave={onSave}
      onSaveAndAddAnother={onSaveAndAddAnother}
      onCancel={onCancel}
      closeWithoutConfirmation={closeWithoutConfirmation}
      onWeekChange={onWeekChange}
      requestCloseRef={requestCloseRef}
    />
  );
}

function useEditorFocus(open: boolean) {
  const createdFocus = useRef<OverviewCreatedFocus | null>(null);
  const requestCloseRef = useRef<(() => void) | null>(null);
  const keepOutsideFocus = useRef(false);
  const rememberFocus = useOverviewFocusReturn(
    open,
    createdFocus,
    keepOutsideFocus,
  );
  return {
    createdFocus,
    requestCloseRef,
    keepFocus: () => {
      keepOutsideFocus.current = true;
    },
    rememberFocus,
  };
}
