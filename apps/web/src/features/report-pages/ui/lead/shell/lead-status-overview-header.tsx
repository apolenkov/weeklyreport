"use client";

import { Button } from "@weeklyreport/ui/components/ui/button";
import type { ComponentProps } from "react";
import { toast } from "sonner";

import { leadPeriodLabel } from "../../../../report-sections";
import { LeadFormHeaderActions } from "../chrome/lead-form-header-actions";
import { LeadOverviewToolbarControls } from "../chrome/lead-form-toolbar-controls";
import { LeadOverviewReviewFeedback } from "../chrome/lead-overview-review-feedback";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function ReadyOverviewHeader({
  editor,
  pendingInput,
  saveStatus,
  blockers,
  completionActions,
}: {
  readonly pendingInput: boolean;
  readonly saveStatus: string | undefined;
  readonly blockers: number;
  readonly editor: ReadyEditor;
  readonly completionActions: ComponentProps<
    typeof LeadFormHeaderActions
  >["completionActions"];
}) {
  return (
    <>
      <LeadFormHeaderActions
        overview
        pendingInput={pendingInput}
        viewModel={editor.view.viewModel}
        writeActions={editor.view.writeActions}
        periodLabel={leadPeriodLabel(
          editor.view.viewModel,
          editor.view.data.byPeriodData?.section.reportId,
        )}
        completionActions={completionActions}
        isSlidesMode={false}
        isForeignSlidesDeck={editor.view.data.isForeignSlidesDeck}
        isSubmitted={editor.view.isSubmitted}
        announceAutosave={false}
      />
      {editor.view.isSubmitted && <p>This report is read-only.</p>}
      <LeadOverviewToolbarControls
        completion={
          <div className="flex items-center gap-2">
            <span
              data-testid="overview-save-state"
              role="status"
              className="text-sm"
            >
              {editor.view.isSubmitted ? "Submitted" : saveStatus}
            </span>
            {!editor.view.viewModel.isReadOnly && (
              <Button
                data-testid="lead-completion-submit"
                aria-disabled={!!blockers || completionActions.submitDisabled}
                onUnavailable={() => focusBlockers(blockers)}
                onClick={completionActions.onSubmit}
              >
                Submit{blockers > 0 ? ` · ${blockers} to fix` : ""}
              </Button>
            )}
            <RetryOverviewSave editor={editor} pendingInput={pendingInput} />
          </div>
        }
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
      {editor.view.data.byPeriodData?.section ? (
        <LeadOverviewReviewFeedback
          section={editor.view.data.byPeriodData.section}
          placement="priority"
        />
      ) : null}
    </>
  );
}

function RetryOverviewSave({
  editor,
  pendingInput,
}: {
  editor: ReadyEditor;
  pendingInput: boolean;
}) {
  if (editor.draft.autosave.state !== "error") return null;
  const recovery = editor.draft.saveRecovery;
  const reason = pendingInput
    ? "Retry saving in the open form."
    : recovery && recovery.phase !== "ambiguous"
      ? "Resolve the saved update first."
      : undefined;
  return (
    <Button
      variant="ghost"
      aria-disabled={!!reason}
      title={reason}
      aria-description={reason}
      onClick={() => {
        if (recovery) editor.draft.retrySameAttempt?.(recovery.token);
        else void editor.draft.autosave.forceSave();
      }}
    >
      Retry save
    </Button>
  );
}

function focusBlockers(blockers: number) {
  document.getElementById("overview-readiness")?.focus();
  if (blockers)
    toast.info(`Not submitted. Finish these ${blockers} things first.`);
}
