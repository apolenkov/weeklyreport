import { useCallback, useState } from "react";

import {
  ownedStagesForProject,
  projectReportHealthPulse,
  projectStatusOverview,
  type StatusOverviewItem,
  type StatusOverviewModel,
} from "../../../../report-sections";
import { openWorkDisabledReason } from "./open-work-register-model";
import { recordPanel } from "./overview-active-record";
import { buildActivityFieldsChange } from "./overview-activity-fields";
import { overviewInlineItemSlot } from "./overview-inline-item-slot";
import { overviewPlanPresentation } from "./overview-plan-presentation";
import { overviewRecordPresentation } from "./overview-record-presentation";
import { itemChange, unitRecordDeletion } from "./overview-reversible-changes";
import { useCompletionPresentation } from "./presentation/use-completion-presentation";
import { useEntryUndo } from "./use-entry-undo";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOpenWorkRegister } from "./use-open-work-register";
import {
  buildOverviewEditor,
  useOverviewItemEditor,
} from "./use-overview-item-editor";
import { useOverviewPlanActions } from "./use-overview-plan-actions";
import {
  FALLBACK_READINESS,
  useOverviewReadiness,
} from "./use-overview-readiness";
import { useOverviewRecordEditor } from "./use-overview-record-editor";
import { useOverviewUndo } from "./use-overview-undo";
import { useOverviewVerdictActions } from "./use-overview-verdict-actions";

export type AvailableEditor = LeadFormEditorHandle;
export type ReadyEditor = Extract<AvailableEditor, { status: "ready" }>;

const FALLBACK_AUTOSAVE = {
  state: "idle" as const,
  lastSavedAt: null,
  dirty: false,
  currentPayloadMatchesSavedBaseline: false,
  isInFlight: false,
  forceSave: () => Promise.resolve(),
};
function useOverviewCompletion(
  editor: ReadyEditor | null,
  isReadOnly: boolean,
) {
  return useCompletionPresentation({
    autosave: editor?.view.autosave ?? FALLBACK_AUTOSAVE,
    handleSubmit: editor?.view.writeActions.handleSubmit ?? (() => undefined),
    readiness: editor?.view.submitReadiness ?? FALLBACK_READINESS,
    isSlidesMode: false,
    isReadOnly,
  });
}

function usePendingActivityIds() {
  const [pendingActivityIds, setPendingActivityIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const onActivityFieldsPendingChange = useCallback(
    (activityId: string, pending: boolean): void => {
      setPendingActivityIds((current) => {
        if (current.has(activityId) === pending) return current;
        const next = new Set(current);
        if (pending) next.add(activityId);
        else next.delete(activityId);
        return next;
      });
    },
    [],
  );
  return { pendingActivityIds, onActivityFieldsPendingChange };
}

export function useOverviewController({
  targetReportId,
  output,
  editor,
}: {
  readonly targetReportId: string;
  readonly output: Parameters<typeof projectStatusOverview>[0];
  readonly editor: AvailableEditor;
}) {
  const { pendingActivityIds, onActivityFieldsPendingChange } =
    usePendingActivityIds();
  const readyEditor = editor.status === "ready" ? editor : null;
  const isReadOnly = readyEditor?.view.viewModel.isReadOnly ?? true;
  const canEdit = readyEditor !== null && !isReadOnly;
  const completion = useOverviewCompletion(readyEditor, isReadOnly);
  const model = projectStatusOverview(output, {
    currentSection: readyEditor?.draft.section,
    currentItemsEditable: canEdit,
  });
  const editing = useOverviewEditing({
    readyEditor,
    model,
    targetReportId,
    output,
    activityPending: pendingActivityIds.size > 0,
  });
  const { plan, record, pendingInput } = editing;
  const undo = useOverviewUndo(readyEditor, pendingInput);
  useEntryUndo(readyEditor, editing.dialog.dialog, undo.announce);
  const verdict = useOverviewVerdictActions(readyEditor, output, undo.write,undo.announce);
  const { saveStatus, readiness,onReasonDraft } = useOverviewReadiness(
    readyEditor,
    editing,
    pendingActivityIds,
  );
  const canStartAction = canEdit && !pendingInput;
  const openWork = useOpenWorkRegister(
    targetReportId,
    readyEditor?.draft.section.items ?? output.current.section.items,
  );
  const openWorkBlocker = openWorkDisabledReason(
    canEdit,
    pendingInput,
    plan.blockedReason,
  );
  return {
    readyEditor,
    ownedStageStartsForProduct: canEdit
      ? (productId: string) =>
          ownedStagesForProject(readyEditor.draft.section, productId)
      : undefined,
    canEdit,
    canStartAction,
    completion,
    model,
    ...editing,
    activeRecord: recordPanel(readyEditor, editing.dialog, model, undo),
    move: (item: StatusOverviewItem) => {
      if (!readyEditor || pendingInput) return;
      const change = itemChange(readyEditor, item, "move");
      if (change) void undo.write(change);
    },
    deleteUnitRecord: (kind: "risk" | "decision", stableId: string) => {
      if (!readyEditor || pendingInput) return;
      const change = unitRecordDeletion(readyEditor, kind, stableId);
      if (change) void undo.write(change);
    },
    health: projectReportHealthPulse(
      model.units,
      readyEditor?.draft.section ?? output.current.section,
    ),
    verdict: { ...verdict, onAddRecord: record.open },
    saveStatus,
    readiness,onReasonDraft,
    openWork,
    openWorkBlocker,
    onActivityFieldsChange: buildActivityFieldsChange(readyEditor),
    onActivityFieldsPendingChange,
  };
}

function useOverviewEditing({
  readyEditor,
  model,
  targetReportId,
  output,
  activityPending,
}: {
  readonly readyEditor: ReadyEditor | null;
  readonly model: StatusOverviewModel;
  readonly targetReportId: string;
  readonly output: Parameters<typeof projectStatusOverview>[0];
  readonly activityPending: boolean;
}) {
  const dialog = useOverviewItemEditor(
    readyEditor,
    model,
    targetReportId,
    output,
  );
  const plan = useOverviewPlanActions(
    readyEditor,
    output,
    model,
    dialog.dialog !== null,
  );
  const planPresentation = overviewPlanPresentation(plan, model);
  const itemSlot = overviewInlineItemSlot(readyEditor, model, dialog);
  const itemEditor = overviewEditor(readyEditor, dialog);
  const record = useOverviewRecordEditor(
    readyEditor,
    model,
    targetReportId,
    dialog.dialog !== null || plan.dialog !== null || activityPending,
  );
  const recordPresentation = overviewRecordPresentation(
    readyEditor,
    model,
    record,
  );
  const pendingInput =
    record.state !== null ||
    dialog.dialog !== null ||
    plan.dialog !== null ||
    activityPending;
  return {
    dialog,
    plan,
    record,
    planPresentation,
    recordPresentation,
    itemSlot,
    itemEditor,
    pendingInput,
  };
}

function overviewEditor(
  editor: ReadyEditor | null,
  dialog: Parameters<typeof overviewInlineItemSlot>[2] & {
    readonly changeWeek: (week: "current" | "next") => void;
  },
) {
  return buildOverviewEditor(
    editor,
    dialog.recoveryReason ? null : dialog.dialog,
    {
      onSave: dialog.save,
      onSaveAndAddAnother: dialog.saveAndAddAnother,
      onCancel: dialog.close,
      onWeekChange: dialog.changeWeek,
      requestCloseRef: dialog.requestCloseRef,
    },
  );
}
