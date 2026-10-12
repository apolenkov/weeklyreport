"use client";

import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
} from "@weeklyreport/shared";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import type { useAiProviderMutations } from "./ai-provider-mutations";
import { AiProviderRetainedRevisions } from "./ai-provider-retained-revisions";
import { AiProviderRevisionDetails } from "./ai-provider-revision-details";

type AiProviderMutations = ReturnType<typeof useAiProviderMutations>;

export function AiProviderDiagnostics({
  revision,
  data,
  mutations,
  allBusy,
}: Readonly<{
  revision: AiProviderConfigurationRead;
  data: AiProviderControlRead;
  mutations: AiProviderMutations;
  allBusy: boolean;
}>) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnosticsBaseId = useId();
  const diagnosticsSummaryId = `${diagnosticsBaseId}-summary`;
  const diagnosticsPanelId = `${diagnosticsBaseId}-panel`;
  return (
    <details
      className="group mt-4 border-t border-[var(--color-border)] pt-3"
      data-testid="ai-provider-diagnostics"
      open={diagnosticsOpen}
    >
      <summary
        id={diagnosticsSummaryId}
        aria-controls={diagnosticsPanelId}
        aria-expanded={diagnosticsOpen}
        className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-sm)] py-1 text-sm font-semibold text-[var(--color-foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] [&::-webkit-details-marker]:hidden"
        onClick={(event) => {
          event.preventDefault();
          setDiagnosticsOpen((isOpen) => !isOpen);
        }}
      >
        <span className="min-w-0">
          <span className="block text-xs tracking-[0.12em] text-[var(--color-muted-foreground)] uppercase">
            Diagnostics
          </span>
          <span className="mt-1 block font-normal text-[var(--color-muted-foreground)]">
            Provider metadata and retained revisions
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div
        id={diagnosticsPanelId}
        role="region"
        aria-labelledby={diagnosticsSummaryId}
        aria-hidden={!diagnosticsOpen}
        className="mt-3 flex flex-col gap-4"
      >
        {diagnosticsOpen && <AiProviderRevisionDetails revision={revision} />}
        {diagnosticsOpen && (
          <AiProviderRetainedRevisions
            revisions={data.revisions}
            activeRevisionId={data.activeRevisionId}
            busy={allBusy}
            restorePendingRevisionId={
              mutations.restore.isPending
                ? mutations.restore.variables.revisionId
                : null
            }
            onRestore={(id) => mutations.restore.mutate({ revisionId: id })}
            discardPendingRevisionId={
              mutations.discard.isPending
                ? mutations.discard.variables.revisionId
                : null
            }
            onDiscard={(id) => mutations.discard.mutate({ revisionId: id })}
          />
        )}
      </div>
    </details>
  );
}

export function AiProviderLoadError({
  isFetching,
  onRetry,
}: Readonly<{ isFetching: boolean; onRetry: () => void }>) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="alert">
      <p className="text-[var(--color-destructive)]">
        Failed to load AI configuration.
      </p>
      <button
        type="button"
        className="btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
        onClick={onRetry}
        disabled={isFetching}
      >
        {isFetching ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
