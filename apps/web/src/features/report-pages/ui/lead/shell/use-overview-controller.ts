import { useCallback, useState } from "react";

import {
  ownedStagesForProject,
  projectStatusOverview,
} from "../../../../report-sections";
import { openWorkDisabledReason } from "./open-work-register-model";
import { buildActivityFieldsChange } from "./overview-activity-fields";
import { overviewInlineItemSlot } from "./overview-inline-item-slot";
import { overviewPlanPresentation } from "./overview-plan-presentation";
import { unitRecordStarter } from "./overview-unit-record";
import { useCompletionPresentation } from "./presentation/use-completion-presentation";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOpenWorkRegister } from "./use-open-work-register";
import {
  buildOverviewEditor,
  useOverviewItemEditor,
} from "./use-overview-item-editor";
import { useOverviewPlanActions } from "./use-overview-plan-actions";
import { useOverviewVerdictActions } from "./use-overview-verdict-actions";
import { useSaveStatus } from "./use-save-status";

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
const FALLBACK_READINESS = {
  canOpenConfirmation: false,
  submitPending: false,
  blockingIssues: [],
  pendingReviewCount: 0,
  willAutoPromote: [],
  unsetStatuses: [],
  autosaveState: "idle" as const,
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
  const verdict = useOverviewVerdictActions(readyEditor, output);
  const planPresentation = overviewPlanPresentation(plan, model);
  const itemSlot = overviewInlineItemSlot(readyEditor, model, dialog);
  const itemEditor = overviewEditor(readyEditor, dialog);
  const pendingInput =
    dialog.dialog !== null ||
    plan.dialog !== null ||
    pendingActivityIds.size > 0;
  const saveStatus = useSaveStatus(readyEditor, pendingInput, plan.pending);
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
    dialog,
    plan,
    verdict: { ...verdict, onAddRecord: unitRecordStarter(readyEditor) },
    planPresentation,
    itemSlot,
    itemEditor,
    pendingInput,
    saveStatus,
    openWork,
    openWorkBlocker,
    onActivityFieldsChange: buildActivityFieldsChange(readyEditor),
    onActivityFieldsPendingChange,
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
