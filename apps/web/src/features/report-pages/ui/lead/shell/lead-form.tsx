"use client";

import {
  DraftStageMemoryProvider,
  DraftStageMemoryScopeProvider,
} from "../../../../report-sections";
import { LeadFormEmptyState } from "./lead-form-empty-state";
import { LeadFormLoadError } from "./lead-form-load-error";
import { LeadFormLoaded } from "./lead-form-loaded";
import { LeadFormSkeleton } from "./lead-form-skeleton";
import { LeadStatusOverview } from "./lead-status-overview";
import { useLeadFormEditor } from "./use-lead-form-editor";

interface LeadFormProps {
  // Explicit report id from `[reportId]`; bare-route redirect on UseLeadFormDataInput.
  readonly reportId?: string;
  readonly mode?: "overview" | "edit" | "slides";
  readonly redirectToCanonical?: boolean;
}

function LeadFormUnavailable() {
  return (
    <LeadFormEmptyState
      titleId="lead-form-unavailable-title"
      title="Report form unavailable"
    >
      <p role="status" className="text-sm text-[var(--color-foreground)]">
        This reporting period does not have an editable section for your
        account.
      </p>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Choose a report assigned to you, or ask an administrator to assign you a
        section.
      </p>
    </LeadFormEmptyState>
  );
}

function LeadFormEditor(
  props: Omit<LeadFormProps, "mode"> & {
    readonly mode: "edit" | "slides";
  },
) {
  const editor = useLeadFormEditor(props);
  if (editor.status === "no-active") {
    return (
      <LeadFormEmptyState
        titleId="lead-form-no-active-title"
        title="No active reporting period"
      >
        <p role="status" className="text-sm text-[var(--color-foreground)]">
          No active reporting period is available.
        </p>
      </LeadFormEmptyState>
    );
  }
  if (editor.status === "unavailable") return <LeadFormUnavailable />;
  if (editor.status === "error") {
    return (
      <LeadFormLoadError
        isRetrying={editor.isRetrying}
        onRetry={editor.retry}
      />
    );
  }
  if (editor.status === "loading") {
    return <LeadFormSkeleton mode={props.mode} />;
  }
  return (
    <DraftStageMemoryProvider memory={editor.draft.stageMemory}>
      <LeadFormLoaded key={editor.generation} {...editor.view} />
    </DraftStageMemoryProvider>
  );
}

// The stage-memory scope lives above the view switch: Overview and the editor
// are different branches, but a view switch must not forget the open draft's
// remembered stage. Keying on the report starts another report empty.
export function LeadForm({ mode = "edit", ...props }: LeadFormProps) {
  return (
    <DraftStageMemoryScopeProvider key={props.reportId ?? "current-report"}>
      {mode === "overview" ? (
        <LeadStatusOverview {...props} />
      ) : (
        <LeadFormEditor {...props} mode={mode} />
      )}
    </DraftStageMemoryScopeProvider>
  );
}
