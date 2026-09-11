"use client";

import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
  AiProviderDraft,
} from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
import { AiProviderCardFeedback } from "./ai-provider-card-feedback";
import { AiProviderForm, toAiProviderForm } from "./ai-provider-form";
import {
  AI_PROVIDER_TEST_QUEUED_MESSAGE,
  providerTestExecutionMessage,
  useAiProviderMutations,
} from "./ai-provider-mutations";
import { AiProviderRetainedRevisions } from "./ai-provider-retained-revisions";
import { AiProviderRevisionDetails } from "./ai-provider-revision-details";
import { selectObservedRevision } from "./ai-provider-revision-selection";
import { AiProviderStateSummary } from "./ai-provider-state-summary";

type AiProviderMutations = ReturnType<typeof useAiProviderMutations>;

const getAiProviderView = (
  revision: AiProviderConfigurationRead | null,
  editing: boolean,
) => ({
  lifecycle: revision ? revision.lifecycle : ("none" as const),
  activeReadOnly: revision
    ? revision.lifecycle === "active" && !editing
    : false,
});

type AiProviderCardContentProps = Readonly<{
  data: AiProviderControlRead;
  savedRevision: AiProviderConfigurationRead | null;
  message: string | null;
  operationFailed?: boolean;
  mutations: AiProviderMutations;
  onSave: (draft: AiProviderDraft) => void;
}>;

const mutationsAreBusy = (mutations: AiProviderMutations): boolean =>
  Object.values(mutations).some((mutation) => mutation.isPending);

export function AiProviderCardContent({
  data,
  savedRevision,
  message,
  operationFailed = false,
  mutations,
  onSave,
}: AiProviderCardContentProps) {
  const revision = selectObservedRevision(data, savedRevision);
  const revisionId = revision?.id ?? null;
  const executionMessage = revision
    ? providerTestExecutionMessage(revision)
    : null;
  const observedMessage =
    message === AI_PROVIDER_TEST_QUEUED_MESSAGE
      ? (executionMessage ?? message)
      : (message ?? executionMessage);
  const allBusy = mutationsAreBusy(mutations);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnosticsBaseId = useId();
  const diagnosticsSummaryId = `${diagnosticsBaseId}-summary`;
  const diagnosticsPanelId = `${diagnosticsBaseId}-panel`;
  const [editingActiveRevisionId, setEditingActiveRevisionId] = useState<
    string | null
  >(null);
  const [disableRequested, setDisableRequested] = useState(false);
  useEffect(() => {
    if (revision?.lifecycle !== "active" && editingActiveRevisionId !== null) {
      queueMicrotask(() => setEditingActiveRevisionId(null));
    }
  }, [editingActiveRevisionId, revision?.lifecycle]);
  const editing =
    revision?.lifecycle === "active" && editingActiveRevisionId === revisionId;
  const { lifecycle, activeReadOnly } = getAiProviderView(revision, editing);

  return (
    <div data-testid="integration-row-ai">
      <AiProviderStateSummary
        lifecycle={lifecycle}
        availability={data.availability}
        revision={revision}
        onEdit={() => setEditingActiveRevisionId(revisionId)}
        onDisable={() => setDisableRequested(true)}
        disablePending={allBusy}
        showActiveActions={activeReadOnly}
      />
      {!activeReadOnly && (
        <AiProviderForm
          key={revisionId ?? "new"}
          initial={toAiProviderForm(revision)}
          revision={revision}
          revisionId={revisionId}
          availability={data.availability}
          profileCapabilities={data.profileCapabilities}
          busy={allBusy}
          savePending={mutations.save.isPending}
          testPending={mutations.test.isPending}
          activatePending={mutations.activate.isPending}
          disablePending={mutations.disable.isPending}
          onSave={onSave}
          onTest={(id) => mutations.test.mutate({ revisionId: id })}
          onActivate={(id) => mutations.activate.mutate({ revisionId: id })}
          onDisable={() => mutations.disable.mutate()}
          onCancelEdit={
            editing ? () => setEditingActiveRevisionId(null) : undefined
          }
        />
      )}

      <ConfirmationDialog
        open={disableRequested}
        onClose={() => setDisableRequested(false)}
        onConfirm={() => {
          mutations.disable.mutate();
          setDisableRequested(false);
        }}
        title="Disable AI for all users?"
        description="Turn off AI provider access for all users."
        confirmLabel="Disable"
        variant="destructive"
      />

      <AiProviderCardFeedback
        revision={revision}
        message={observedMessage}
        operationFailed={operationFailed}
      />
      {revision && (
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
            {diagnosticsOpen && (
              <AiProviderRevisionDetails revision={revision} />
            )}
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
      )}
    </div>
  );
}

export function AiProviderCard({
  onRefreshDependents,
}: Readonly<{
  onRefreshDependents?: () => Promise<unknown> | void;
}> = {}) {
  const pollIntervalMs = 1500;
  const trpc = useTRPC();
  const aiQ = useQuery({
    ...trpc.admin.aiProvider.get.queryOptions(),
    refetchInterval: (query) =>
      query.state.data?.revisions.some(
        (revision) =>
          revision.latestExecution?.state === "queued" ||
          revision.latestExecution?.state === "running",
      )
        ? pollIntervalMs
        : false,
  });
  const [savedRevision, setSavedRevision] =
    useState<AiProviderConfigurationRead | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [operationFailed, setOperationFailed] = useState(false);
  const mutations = useAiProviderMutations({
    trpc,
    refresh: () => {
      void aiQ.refetch();
      void onRefreshDependents?.();
    },
    setSavedRevision,
    setMessage,
    setOperationFailed,
  });

  if (aiQ.isLoading) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Loading AI configuration…
      </p>
    );
  }
  if (aiQ.isError || !aiQ.data) {
    return (
      <div className="flex flex-wrap items-center gap-3" role="alert">
        <p className="text-[var(--color-destructive)]">
          Failed to load AI configuration.
        </p>
        <button
          type="button"
          className="btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
          onClick={() => void aiQ.refetch()}
          disabled={aiQ.isFetching}
        >
          {aiQ.isFetching ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }
  return (
    <AiProviderCardContent
      data={aiQ.data}
      savedRevision={savedRevision}
      message={message}
      operationFailed={operationFailed}
      mutations={mutations}
      onSave={(draft) => mutations.save.mutate(draft)}
    />
  );
}
