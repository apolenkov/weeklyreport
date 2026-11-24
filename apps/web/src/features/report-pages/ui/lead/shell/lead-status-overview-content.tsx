"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps, ReactNode, RefObject } from "react";

import { SdlcTooltipProvider } from "../../../../../shared/ui/feedback/sdlc-tooltip";
import {
  projectStatusOverview,
  StatusOverview,
  type StatusOverviewItem,
} from "../../../../report-sections";
import { LeadCompletionLayout } from "../chrome/lead-completion-layout";
import { LeadFormDialogs } from "../chrome/lead-form-dialogs";
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
import { OverviewItemDialogSurface } from "./overview-item-dialog-surface";
import { overviewItemActions } from "./overview-plan-presentation";
import type { CompletionPresentation } from "./presentation/use-completion-presentation";
import { RetainedRecordCopyRequest } from "./retained-record-copy-request";
import {
  type AvailableEditor,
  type ReadyEditor,
  useOverviewController,
} from "./use-overview-controller";

interface OverviewDialogSlice {
  readonly dialog: OverviewItemDialogState | null;
  readonly recoveryReason: string | null;
  readonly close: () => void;
  readonly requestCloseRef: RefObject<(() => void) | null>;
  readonly moveItem: (
    item: StatusOverviewItem,
    target: "current" | "next",
    focusKey?: string,
  ) => void;
  readonly confirmItem: (item: StatusOverviewItem) => void;
  readonly setItemStatus: NonNullable<
    ComponentProps<typeof StatusOverview>["onSetStatus"]
  >;
  readonly setItemStages: NonNullable<
    ComponentProps<typeof StatusOverview>["onSetStages"]
  >;
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

function OverviewEditorNotices({
  dialog,
  error,
  itemEditor,
}: {
  readonly dialog: OverviewDialogSlice;
  readonly error: string | null;
  readonly itemEditor: ReactNode;
}) {
  if (!dialog.dialog) return null;
  return (
    <OverviewItemDialogSurface
      title={
        dialog.recoveryReason
          ? "Unsaved update recovery"
          : dialog.dialog.mode === "create"
            ? "Add item"
            : "Edit item"
      }
      onCancel={dialog.close}
      requestCloseRef={dialog.requestCloseRef}
    >
      {dialog.recoveryReason ? (
        <OverviewInputRecovery
          dialog={dialog.dialog}
          reason={dialog.recoveryReason}
          onCancel={dialog.close}
          requestCloseRef={dialog.requestCloseRef}
        />
      ) : (
        itemEditor
      )}
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      ) : null}
    </OverviewItemDialogSurface>
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
  // Inline details need no duplicate jump link; retain the unavailable-editor route.
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
  "onVerdict" | "onConfirmAll" | "pendingReviewCount" | "onAddRecord"
>;

function overviewDirectActions(
  enabled: boolean,
  dialog: OverviewDialogSlice,
  verdict: OverviewVerdictSlice,
) {
  return enabled
    ? {
        onAddRecord: verdict.onAddRecord,
        onMoveItem: dialog.moveItem,
        onConfirmItem: dialog.confirmItem,
        onSetStatus: dialog.setItemStatus,
        onSetStages: dialog.setItemStages,
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
  readonly completion: Pick<CompletionPresentation, "completionActions">;
}) {
  if (!editor) return null;
  return (
    <ReadyOverviewHeader
      editor={editor}
      pendingInput={pendingInput}
      completionActions={completion.completionActions}
    />
  );
}

interface LeadStatusOverviewContentProps {
  readonly targetReportId: string;
  readonly output: Parameters<typeof projectStatusOverview>[0];
  readonly editor: AvailableEditor;
  readonly refreshError: boolean;
  readonly onRefresh: () => void;
}

export function LeadStatusOverviewContent({
  targetReportId,
  output,
  editor,
  refreshError,
  onRefresh,
}: LeadStatusOverviewContentProps) {
  const controller = useOverviewController({ targetReportId, output, editor });
  const { readyEditor, model, dialog, plan, verdict } = controller;
  const { canStartAction, itemSlot } = controller;
  const detailsHref = useOverviewDetailsHref(readyEditor, targetReportId);
  return (
    <SdlcTooltipProvider>
      <LeadCompletionLayout>
        <div
          className="min-w-0 space-y-5"
          data-testid="lead-status-overview-page"
          data-layout-key="report-page"
          data-layout-stability="position-width"
        >
          <OverviewHeader
            editor={readyEditor}
            pendingInput={controller.pendingInput}
            completion={controller.completion}
          />
          <EditorAvailabilityNotice editor={editor} />
          <OverviewRefreshWarning failed={refreshError} onRetry={onRefresh} />
          <RetainedRecordCopyRequest
            editor={readyEditor}
            model={model}
            pendingInput={controller.pendingInput}
            onOpen={controller.record.openCopy}
          />
          {controller.planPresentation.recovery}
          {controller.recordPresentation.recovery}
          {!itemSlot && (
            <OverviewEditorNotices
              dialog={dialog}
              error={dialog.error}
              itemEditor={controller.itemEditor}
            />
          )}
          <StatusOverview
            model={model}
            ownedStageStartsForProduct={controller.ownedStageStartsForProduct}
            health={controller.health}
            editorSlot={itemSlot ?? controller.planPresentation.slot}
            recordSlot={controller.recordPresentation.slot}
            {...overviewItemActions(canStartAction, dialog, plan)}
            onAddItem={itemSlot || canStartAction ? dialog.addItem : undefined}
            {...overviewDirectActions(canStartAction, dialog, verdict)}
            detailsHref={detailsHref}
            activityFieldsEditable={controller.canEdit}
            onActivityFieldsChange={controller.onActivityFieldsChange}
            onActivityFieldsPendingChange={
              controller.onActivityFieldsPendingChange
            }
            autosaveStatus={controller.saveStatus}
          />
          <OverviewOpenWork
            openWork={controller.openWork}
            model={model}
            blocker={controller.openWorkBlocker}
            onOpen={plan.openWork}
          />
          <LeadOverviewDetails
            editor={readyEditor}
            pendingInput={controller.pendingInput}
          />
        </div>
      </LeadCompletionLayout>
      <OverviewDialogs editor={readyEditor} />
    </SdlcTooltipProvider>
  );
}
