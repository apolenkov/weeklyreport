"use client";

import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
  AiProviderDraft,
} from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { AiProviderCardFeedback } from "./ai-provider-card-feedback";
import {
  AiProviderForm,
  profileLabel,
  toAiProviderForm,
} from "./ai-provider-form";
import {
  AI_PROVIDER_TEST_QUEUED_MESSAGE,
  providerTestExecutionMessage,
  useAiProviderMutations,
} from "./ai-provider-mutations";
import { AiProviderRetainedRevisions } from "./ai-provider-retained-revisions";
import { AiProviderRevisionDetails } from "./ai-provider-revision-details";
import {
  initialAiProviderCardExpanded,
  selectObservedRevision,
} from "./ai-provider-revision-selection";

type AiProviderMutations = ReturnType<typeof useAiProviderMutations>;

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

function AiProviderCardHeader({
  availability,
  active,
}: Readonly<{
  availability: AiProviderControlRead["availability"];
  active: AiProviderControlRead["active"];
}>) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
            AI provider
          </h3>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-starbucks-accent)] uppercase">
            AI integration
          </p>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-[var(--color-muted-foreground)]">
          Configure the provider used by the Lead assistant and semantic index.
          A saved draft is isolated until you test and activate it.
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap lg:justify-end">
        {active && (
          <span className="min-w-0 max-w-full truncate text-sm text-[var(--color-muted-foreground)]">
            {profileLabel(active.generation.profile)} ·{" "}
            {active.generation.answerModel}
          </span>
        )}
        <span
          className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2.5 py-1 text-sm font-semibold text-[var(--color-foreground)]"
          data-testid="integration-ai-status"
        >
          <span
            className={
              availability === "available"
                ? "size-2 rounded-full bg-[var(--color-primary)]"
                : "size-2 rounded-full bg-[var(--color-muted-foreground)]"
            }
          />
          {availability === "available" ? "Active" : "Not configured"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-data-[expanded=true]:rotate-180"
          data-testid="ai-provider-disclosure-indicator"
        />
      </div>
    </div>
  );
}

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
  const needsAttention = initialAiProviderCardExpanded(
    data,
    revision,
    observedMessage,
  );
  const [expanded, setExpanded] = useState(needsAttention);
  const allBusy = mutationsAreBusy(mutations);
  const disclosureId = useId();
  const toggleId = `${disclosureId}-toggle`;
  const panelId = `${disclosureId}-panel`;

  return (
    <div
      className="border-t border-[var(--color-border)] pt-4 sm:pt-5"
      data-testid="integration-row-ai"
    >
      <button
        id={toggleId}
        type="button"
        className="group w-full text-left"
        data-expanded={expanded}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label="Toggle AI provider settings"
        onClick={() => setExpanded((value) => !value)}
      >
        <AiProviderCardHeader
          availability={data.availability}
          active={data.active}
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={toggleId}
        aria-hidden={!expanded}
        hidden={!expanded}
      >
        {expanded && (
          <>
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
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-sm)] py-1 text-sm font-semibold text-[var(--color-foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] [&::-webkit-details-marker]:hidden">
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
                <div className="mt-3 flex flex-col gap-4">
                  <AiProviderRevisionDetails revision={revision} />
                  <AiProviderRetainedRevisions
                    revisions={data.revisions}
                    activeRevisionId={data.activeRevisionId}
                    busy={allBusy}
                    restorePendingRevisionId={
                      mutations.restore.isPending
                        ? mutations.restore.variables.revisionId
                        : null
                    }
                    onRestore={(id) =>
                      mutations.restore.mutate({ revisionId: id })
                    }
                    discardPendingRevisionId={
                      mutations.discard.isPending
                        ? mutations.discard.variables.revisionId
                        : null
                    }
                    onDiscard={(id) =>
                      mutations.discard.mutate({ revisionId: id })
                    }
                  />
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function AiProviderCard() {
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
