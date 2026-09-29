"use client";

import type { ComponentProps } from "react";

import { leadPeriodLabel } from "../../../../report-sections";
import { LeadFormHeaderActions } from "../chrome/lead-form-header-actions";
import { LeadOverviewToolbarControls } from "../chrome/lead-form-toolbar-controls";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function ReadyOverviewHeader({
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
        periodLabel={leadPeriodLabel(
          editor.view.viewModel,
          editor.view.data.byPeriodData?.section.reportId,
        )}
        completionActions={completionActions}
        completionSentinelRef={completionSentinelRef}
        showCompletionActions
        isSlidesMode={false}
        isForeignSlidesDeck={editor.view.data.isForeignSlidesDeck}
        isSubmitted={editor.view.isSubmitted}
        announceAutosave={false}
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
