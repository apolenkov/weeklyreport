"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";

import { SdlcTooltipProvider } from "../../../../../shared/ui/feedback/sdlc-tooltip";
import {
  projectReportHealthPulse,
  projectStatusOverview,
  StatusOverview,
} from "../../../../report-sections";
import { autosaveStatusCopy } from "../chrome/autosave-state-copy";
import { LeadFormDialogs } from "../chrome/lead-form-dialogs";
import { LeadFormHeaderActions } from "../chrome/lead-form-header-actions";
import { LeadOverviewToolbarControls } from "../chrome/lead-form-toolbar-controls";
import { EditorAvailabilityNotice } from "./lead-editor-availability-notice";
import { LeadOverviewDetails } from "./lead-overview-details";
export { buildStatusOverviewDetailsHref } from "./lead-status-overview-content-helpers";
import { buildStatusOverviewDetailsHref } from "./lead-status-overview-content-helpers";
import { OverviewInputRecovery } from "./lead-status-overview-item-editor";
import { OpenWorkRegister } from "./open-work-register";
import {
  openWorkDisabledReason,
  openWorkOutsideTimeline,
} from "./open-work-register-model";
import {
  overviewItemActions,
  overviewPlanPresentation,
} from "./overview-plan-presentation";
import { useCompletionPresentation } from "./presentation/use-completion-presentation";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOpenWorkRegister } from "./use-open-work-register";
import {
  buildOverviewEditorSlot,
  useOverviewItemEditor,
} from "./use-overview-item-editor";
import { useOverviewPlanActions } from "./use-overview-plan-actions";

type AvailableEditor = LeadFormEditorHandle;
type ReadyEditor = Extract<AvailableEditor, { status: "ready" }>;

const FALLBACK_AUTOSAVE = {
  state: "idle" as const,
  lastSavedAt: null,
  dirty: false,
  isInFlight: false,
  forceSave: () => Promise.resolve(),
};
const FALLBACK_READINESS = {
  canOpenConfirmation: false,
  submitPending: false,
  blockingIssues: [],
  willAutoPromote: [],
  unsetStatuses: [],
  autosaveState: "idle" as const,
};

function ReadyOverviewHeader({
  editor,
  pendingInput,
  completionActions,
  completionSentinelRef,
}: {
  readonly pendingInput: boolean;
  readonly editor: ReadyEditor;
  readonly completionActions: ComponentProps<
    typeof LeadFormHeaderActions
  >["completionActions"];
  readonly completionSentinelRef: ComponentProps<
    typeof LeadFormHeaderActions
  >["completionSentinelRef"];
}) {
  return (
    <>
      <LeadFormHeaderActions
        pendingInput={pendingInput}
        viewModel={editor.view.viewModel}
        writeActions={editor.view.writeActions}
        completionActions={completionActions}
        completionSentinelRef={completionSentinelRef}
        showCompletionActions
        isSlidesMode={false}
        isSubmitted={editor.view.isSubmitted}
      />
      <LeadOverviewToolbarControls
        viewModel={editor.view.viewModel}
        leadSubmittedAt={
          editor.view.data.byPeriodData?.section.submittedAt ?? null
        }
        showArchivePeriods={editor.view.showArchivePeriods}
        onShowArchivePeriodsChange={editor.view.onShowArchivePeriodsChange}
        toolbarVisibility={editor.view.data.toolbarVisibility}
        onVisibilityChange={editor.view.data.onRecordVisibilityChange}
        targetReportId={editor.view.data.targetReportId}
      />
    </>
  );
}

function useOverviewCompletion(
  editor: ReadyEditor | null,
  isReadOnly: boolean,
) {
  return useCompletionPresentation({
    autosave: editor?.view.autosave ?? FALLBACK_AUTOSAVE,
    products: editor?.view.viewModel.products ?? [],
    activityCount: editor?.view.viewModel.activityOptions.length ?? 0,
    onQuickAdd: editor?.view.draftActions.onQuickAdd ?? (() => undefined),
    handleSubmit: editor?.view.writeActions.handleSubmit ?? (() => undefined),
    readiness: editor?.view.submitReadiness ?? FALLBACK_READINESS,
    isSlidesMode: false,
    isReadOnly,
  });
}

function overviewSaveStatus(
  editor: ReadyEditor | null,
  pendingInput: boolean,
  outcomePending: boolean,
): string | undefined {
  if (outcomePending) return "Saving plan outcome…";
  if (pendingInput) return "Unsaved update — save or cancel the open edit";
  if (!editor || editor.view.viewModel.isReadOnly) return undefined;
  return autosaveStatusCopy(editor.draft.autosave.state);
}

function OverviewRefreshWarning({
  failed,
  onRetry,
}: {
  readonly failed: boolean;
  readonly onRetry: () => void;
}) {
  if (!failed) return null;
  return (
    <div
      role="alert"
      className="space-y-2 border-l-2 border-[var(--color-status-at-risk-border)] pl-3 text-sm"
    >
      <p>Overview could not refresh. Showing the last loaded overview.</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-[var(--color-primary)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        Retry overview
      </button>
    </div>
  );
}

export function LeadStatusOverviewContent({
  targetReportId,
  output,
  editor,
  refreshError,
  onRefresh,
}: {
  readonly targetReportId: string;
  readonly output: Parameters<typeof projectStatusOverview>[0];
  readonly editor: AvailableEditor;
  readonly refreshError: boolean;
  readonly onRefresh: () => void;
}) {
  const searchParams = useSearchParams();
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
    isReadOnly,
    model,
    targetReportId,
  );
  const plan = useOverviewPlanActions(
    readyEditor,
    output,
    model,
    dialog.dialog !== null,
  );
  const planPresentation = overviewPlanPresentation(plan, model);
  const editorSlot =
    planPresentation.slot ??
    buildOverviewEditorSlot(
      readyEditor,
      dialog.recoveryReason ? null : dialog.dialog,
      dialog.save,
      dialog.close,
    );
  const pendingInput = dialog.dialog !== null || plan.dialog !== null;
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
  const overview = (
    <div
      className="min-w-0 space-y-6"
      data-testid="lead-status-overview-page"
      data-layout-key="report-page"
      data-layout-stability="position-width"
    >
      {readyEditor ? (
        <ReadyOverviewHeader
          editor={readyEditor}
          pendingInput={pendingInput}
          completionActions={completion.completionActions}
          completionSentinelRef={completion.sentinelRef}
        />
      ) : null}
      <EditorAvailabilityNotice editor={editor} />
      <OverviewRefreshWarning failed={refreshError} onRetry={onRefresh} />
      {planPresentation.recovery}
      {dialog.dialog && dialog.recoveryReason ? (
        <OverviewInputRecovery
          dialog={dialog.dialog}
          reason={dialog.recoveryReason}
          onCancel={dialog.close}
        />
      ) : null}
      {dialog.error ? (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {dialog.error}
        </p>
      ) : null}
      <StatusOverview
        model={model}
        health={projectReportHealthPulse(
          model.units,
          readyEditor?.draft.section ?? output.current.section,
        )}
        editorSlot={editorSlot}
        {...overviewItemActions(canStartAction, dialog, plan)}
        detailsHref={
          readyEditor
            ? "#report-details"
            : buildStatusOverviewDetailsHref(targetReportId, searchParams)
        }
        autosaveStatus={overviewSaveStatus(
          readyEditor,
          pendingInput,
          plan.pending,
        )}
      />
      <OpenWorkRegister
        query={{
          ...openWork,
          openItems: openWorkOutsideTimeline(
            openWork.openItems,
            model.units.flatMap((unit) => unit.columns.previouslyPlanned.items),
          ),
        }}
        actionsDisabled={openWorkBlocker !== null}
        disabledReason={openWorkBlocker}
        onOpen={plan.openWork}
      />
      <LeadOverviewDetails editor={readyEditor} pendingInput={pendingInput} />
    </div>
  );

  return (
    <SdlcTooltipProvider>
      {overview}
      {readyEditor ? (
        <LeadFormDialogs
          viewModel={readyEditor.view.viewModel}
          quickAdd={readyEditor.view.draftActions}
          writeActions={readyEditor.view.writeActions}
          unsetOwnStageCount={readyEditor.view.unsetOwnStageCount}
          draftSection={readyEditor.view.draftSection}
          isSlidesMode={false}
        />
      ) : null}
    </SdlcTooltipProvider>
  );
}
