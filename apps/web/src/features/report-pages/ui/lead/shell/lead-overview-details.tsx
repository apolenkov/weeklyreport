import { LeadOverviewSupportSections } from "../chrome/lead-overview-support-sections";
import { LeadSubmitReadinessSummary } from "../chrome/lead-submit-readiness-summary";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function LeadOverviewDetails({
  editor,
  pendingInput,
}: {
  readonly editor: ReadyEditor | null;
  readonly pendingInput: boolean;
}) {
  if (!editor) return null;
  const { view } = editor;
  const serverSection = view.data.byPeriodData?.section;
  if (!serverSection) return null;
  return (
    <div id="report-details" className="min-w-0 space-y-6">
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
      {pendingInput ? (
        <p
          role="status"
          className="text-sm text-[var(--color-muted-foreground)]"
        >
          Save or cancel the open update before submitting the report.
        </p>
      ) : !view.viewModel.isReadOnly ? (
        <LeadSubmitReadinessSummary
          readiness={view.submitReadiness}
          onSubmit={view.writeActions.handleSubmit}
        />
      ) : null}
    </div>
  );
}
