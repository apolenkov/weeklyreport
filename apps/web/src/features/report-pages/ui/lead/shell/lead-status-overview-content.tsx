"use client";

import type { ItemWorkflowStatus } from "@weeklyreport/shared";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";

import { SdlcTooltipProvider } from "../../../../../shared/ui/feedback/sdlc-tooltip";
import {
  projectReportHealthPulse,
  projectStatusOverview,
  StatusOverview,
  type StatusOverviewItem,
} from "../../../../report-sections";
import { LeadFormDialogs } from "../chrome/lead-form-dialogs";
import {
  LEAD_STICKY_COMPLETION_CLEARANCE_CLASS,
  LeadStickyCompletionActions,
} from "../chrome/lead-sticky-completion-actions";
import { EditorAvailabilityNotice } from "./lead-editor-availability-notice";
import { LeadOverviewDetails } from "./lead-overview-details";
export { buildStatusOverviewDetailsHref } from "./lead-status-overview-content-helpers";
import { buildStatusOverviewDetailsHref } from "./lead-status-overview-content-helpers";
import { ReadyOverviewHeader } from "./lead-status-overview-header";
import {
  OverviewInputRecovery,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import { OpenWorkRegister } from "./open-work-register";
import { openWorkOutsideTimeline } from "./open-work-register-model";
import { overviewItemActions } from "./overview-plan-presentation";
import type { CompletionPresentation } from "./presentation/use-completion-presentation";
import {
  type AvailableEditor,
  type ReadyEditor,
  useOverviewController,
} from "./use-overview-controller";

interface OverviewDialogSlice {
  readonly dialog: OverviewItemDialogState | null;
  readonly recoveryReason: string | null;
  readonly close: () => void;
  readonly moveItem: (
    item: StatusOverviewItem,
    target: "current" | "next",
    focusKey?: string,
  ) => void;
  readonly confirmItem: (item: StatusOverviewItem) => void;
  readonly setItemStatus: (
    item: StatusOverviewItem,
    status: ItemWorkflowStatus,
    focusKey?: string,
  ) => void;
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

function OverviewEditorRecovery({
  dialog,
}: {
  readonly dialog: OverviewDialogSlice;
}) {
  if (!dialog.dialog || !dialog.recoveryReason) return null;
  return (
    <OverviewInputRecovery
      dialog={dialog.dialog}
      reason={dialog.recoveryReason}
      onCancel={dialog.close}
    />
  );
}

function OverviewEditorNotices({
  dialog,
  error,
}: {
  readonly dialog: OverviewDialogSlice;
  readonly error: string | null;
}) {
  return (
    <>
      <OverviewEditorRecovery dialog={dialog} />
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      ) : null}
    </>
  );
}

function OverviewDialogs({ editor }: { readonly editor: ReadyEditor | null }) {
  if (!editor) return null;
  return (
    <LeadFormDialogs
      viewModel={editor.view.viewModel}
      quickAdd={editor.view.draftActions}
      writeActions={editor.view.writeActions}
      unsetOwnStageCount={editor.view.unsetOwnStageCount}
      draftSection={editor.view.draftSection}
      isSlidesMode={false}
    />
  );
}

function useOverviewDetailsHref(
  readyEditor: ReadyEditor | null,
  targetReportId: string,
) {
  const searchParams = useSearchParams();
  // With the editor ready the risks/decisions surface renders inline below the
  // overview, so a jump link only duplicates scrolling; keep it solely as the
  // fallback path to the standalone details view when the editor is absent.
  return readyEditor
    ? undefined
    : buildStatusOverviewDetailsHref(targetReportId, searchParams);
}

function OverviewOpenWork({
  openWork,
  model,
  blocker,
  onOpen,
}: {
  readonly openWork: ComponentProps<typeof OpenWorkRegister>["query"];
  readonly model: ReturnType<typeof projectStatusOverview>;
  readonly blocker: string | null;
  readonly onOpen: ComponentProps<typeof OpenWorkRegister>["onOpen"];
}) {
  return (
    <OpenWorkRegister
      query={{
        ...openWork,
        openItems: openWorkOutsideTimeline(
          openWork.openItems,
          model.units.flatMap((unit) => unit.columns.previouslyPlanned.items),
        ),
      }}
      actionsDisabled={blocker !== null}
      disabledReason={blocker}
      onOpen={onOpen}
    />
  );
}

type OverviewVerdictSlice = Pick<
  ComponentProps<typeof StatusOverview>,
  "onVerdict" | "onConfirmAll" | "pendingReviewCount"
>;

function overviewDirectActions(
  enabled: boolean,
  dialog: OverviewDialogSlice,
  verdict: OverviewVerdictSlice,
) {
  return enabled
    ? {
        onMoveItem: dialog.moveItem,
        onConfirmItem: dialog.confirmItem,
        onSetStatus: dialog.setItemStatus,
        onVerdict: verdict.onVerdict,
        onConfirmAll: verdict.onConfirmAll,
        pendingReviewCount: verdict.pendingReviewCount,
      }
    : {};
}

function OverviewHeader({
  editor,
  pendingInput,
  completion,
}: {
  readonly editor: ReadyEditor | null;
  readonly pendingInput: boolean;
  readonly completion: Pick<
    CompletionPresentation,
    "completionActions" | "headerActionsVisible" | "sentinelRef"
  >;
}) {
  if (!editor) return null;
  return (
    <ReadyOverviewHeader
      editor={editor}
      pendingInput={pendingInput}
      completionActions={completion.completionActions}
      completionSentinelRef={completion.sentinelRef}
      showCompletionActions={completion.headerActionsVisible}
    />
  );
}

function OverviewSticky({
  completion: { showStickyCompletion, completionActions: actions },
  pending,
}: {
  readonly completion: Pick<
    CompletionPresentation,
    "showStickyCompletion" | "completionActions"
  >;
  readonly pending: boolean;
}) {
  if (!showStickyCompletion) return null;
  // Same guard as the header cluster: no submit with an open update.
  return (
    <LeadStickyCompletionActions
      actions={{
        ...actions,
        submitDisabled: actions.submitDisabled || pending,
      }}
    />
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
  const {
    readyEditor,
    canEdit,
    canStartAction,
    completion,
    model,
    dialog,
    plan,
    verdict,
    planPresentation,
    editorSlot,
    pendingInput,
    saveStatus,
    openWork,
    openWorkBlocker,
    onActivityFieldsChange,
    onActivityFieldsPendingChange,
  } = useOverviewController({ targetReportId, output, editor });
  const detailsHref = useOverviewDetailsHref(readyEditor, targetReportId);
  return (
    <SdlcTooltipProvider>
      <div
        className={`min-w-0 space-y-5 ${completion.showStickyCompletion ? LEAD_STICKY_COMPLETION_CLEARANCE_CLASS : ""}`}
        data-testid="lead-status-overview-page"
        data-layout-key="report-page"
        data-layout-stability="position-width"
      >
        <OverviewHeader
          editor={readyEditor}
          pendingInput={pendingInput}
          completion={completion}
        />
        <EditorAvailabilityNotice editor={editor} />
        <OverviewRefreshWarning failed={refreshError} onRetry={onRefresh} />
        {planPresentation.recovery}
        <OverviewEditorNotices dialog={dialog} error={dialog.error} />
        <StatusOverview
          model={model}
          health={projectReportHealthPulse(
            model.units,
            readyEditor?.draft.section ?? output.current.section,
          )}
          editorSlot={editorSlot}
          {...overviewItemActions(canStartAction, dialog, plan)}
          {...overviewDirectActions(canStartAction, dialog, verdict)}
          detailsHref={detailsHref}
          activityFieldsEditable={canEdit}
          onActivityFieldsChange={onActivityFieldsChange}
          onActivityFieldsPendingChange={onActivityFieldsPendingChange}
          autosaveStatus={saveStatus}
        />
        <OverviewOpenWork
          openWork={openWork}
          model={model}
          blocker={openWorkBlocker}
          onOpen={plan.openWork}
        />
        <LeadOverviewDetails editor={readyEditor} pendingInput={pendingInput} />
      </div>
      <OverviewSticky completion={completion} pending={pendingInput} />
      <OverviewDialogs editor={readyEditor} />
    </SdlcTooltipProvider>
  );
}
