import { LeadOverviewSupportSections } from "../chrome/lead-overview-support-sections";
import { LeadSubmitReadinessSummary } from "../chrome/lead-submit-readiness-summary";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function LeadOverviewDetails({
  hasUnansweredPlans,
  editor,
  pendingInput,
  readiness,
}: {
  readonly hasUnansweredPlans: boolean;
  readonly editor: ReadyEditor | null;
  readonly pendingInput: boolean;
  readonly readiness: ReadyEditor["view"]["submitReadiness"];
}) {
  if (!editor) return null;
  const { view } = editor;
  const serverSection = view.data.byPeriodData?.section;
  if (!serverSection) return null;
  return (
    <div id="report-details" tabIndex={-1} className="min-w-0 space-y-3">
      <LeadOverviewSupportSections
        viewModel={view.viewModel}
        actions={view.draftActions}
        draftSection={editor.draft.section}
        serverSection={serverSection}
        groupExpanded={false}
        recordVisibility={view.data.recordVisibility}
        visibilityHydrated={view.data.visibilityHydrated}
        crossAuthorEntries={view.data.crossAuthors}
        pendingInput={pendingInput}
      />
      {!view.viewModel.isReadOnly || pendingInput ? (
        <div id="overview-readiness" tabIndex={-1}>
          <LeadSubmitReadinessSummary
            hasUnansweredPlans={hasUnansweredPlans}
            readiness={readiness}
            onSubmit={view.writeActions.handleSubmit}
            showSubmitAction={false}
            showAutosaveStatus={false}
          />
        </div>
      ) : null}
    </div>
  );
}
