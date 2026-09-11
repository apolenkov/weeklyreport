"use client";

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
    <section
      aria-labelledby="lead-form-unavailable-title"
      className="card-surface space-y-3 p-6"
    >
      <h1
        id="lead-form-unavailable-title"
        className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]"
      >
        Report form unavailable
      </h1>
      <p role="status" className="text-sm text-[var(--color-foreground)]">
        This reporting period does not have an editable section for your
        account.
      </p>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Choose a report assigned to you or contact your reporting lead.
      </p>
    </section>
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
      <section className="card-surface p-6" role="status">
        No active reporting period is available.
      </section>
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
  return <LeadFormLoaded key={editor.generation} {...editor.view} />;
}

export function LeadForm({ mode = "edit", ...props }: LeadFormProps) {
  if (mode === "overview") return <LeadStatusOverview {...props} />;
  return <LeadFormEditor {...props} mode={mode} />;
}
