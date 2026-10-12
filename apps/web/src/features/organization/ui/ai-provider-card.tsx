"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
  AiProviderDraft,
} from "@weeklyreport/shared";
import { useEffect, useState } from "react";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
import { AiProviderCardFeedback } from "./ai-provider-card-feedback";
import {
  AiProviderDiagnostics,
  AiProviderLoadError,
} from "./ai-provider-diagnostics";
import { AiProviderForm, toAiProviderForm } from "./ai-provider-form";
import {
  AI_PROVIDER_TEST_QUEUED_MESSAGE,
  providerTestExecutionMessage,
  useAiProviderMutations,
} from "./ai-provider-mutations";
import {
  selectObservedRevision,
  useSavedRevisionPin,
} from "./ai-provider-revision-selection";
import { AiProviderStateSummary } from "./ai-provider-state-summary";

type AiProviderMutations = ReturnType<typeof useAiProviderMutations>;
type ActivationOperation = "activate" | "restore";

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

const preparationIsPending = (revision: AiProviderConfigurationRead): boolean =>
  revision.lifecycle === "preparing" && revision.progress.finishedAt === null;

function useRevisionEditing(revision: AiProviderConfigurationRead | null) {
  const revisionId = revision?.id ?? null;
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
  return {
    editing,
    startEditing: () => setEditingActiveRevisionId(revisionId),
    stopEditing: () => setEditingActiveRevisionId(null),
    disableRequested,
    setDisableRequested,
  };
}

function observeMessage(
  revision: AiProviderConfigurationRead | null,
  message: string | null,
): string | null {
  const executionMessage = revision
    ? providerTestExecutionMessage(revision)
    : null;
  return message === AI_PROVIDER_TEST_QUEUED_MESSAGE
    ? (executionMessage ?? message)
    : (message ?? executionMessage);
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
  const observedMessage = observeMessage(revision, message);
  const allBusy = mutationsAreBusy(mutations);
  const {
    editing,
    startEditing,
    stopEditing,
    disableRequested,
    setDisableRequested,
  } = useRevisionEditing(revision);
  const { lifecycle, activeReadOnly } = getAiProviderView(revision, editing);

  return (
    <div data-testid="integration-row-ai">
      <AiProviderStateSummary
        lifecycle={lifecycle}
        availability={data.availability}
        revision={revision}
        onEdit={() => startEditing()}
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
          onCancelEdit={editing ? () => stopEditing() : undefined}
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
        <AiProviderDiagnostics
          revision={revision}
          data={data}
          mutations={mutations}
          allBusy={allBusy}
        />
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
  const [activationPending, setActivationPending] = useState({
    activate: false,
    restore: false,
  });
  const onActivationPendingChange = (
    operation: ActivationOperation,
    pending: boolean,
  ) => {
    setActivationPending((current) =>
      current[operation] === pending
        ? current
        : { ...current, [operation]: pending },
    );
  };
  const trpc = useTRPC();
  const aiQ = useQuery({
    ...trpc.admin.aiProvider.get.queryOptions(),
    refetchInterval: (query) =>
      activationPending.activate ||
      activationPending.restore ||
      query.state.data?.revisions.some(
        (revision) =>
          preparationIsPending(revision) ||
          revision.latestExecution?.state === "queued" ||
          revision.latestExecution?.state === "running",
      )
        ? pollIntervalMs
        : false,
  });
  // The pin records when the revision was saved so a post-save refetch that
  // still lacks it (external discard / history window) can retire it instead
  // of displaying a phantom revision forever.
  const { savedRevision, setSavedRevision } = useSavedRevisionPin(
    aiQ.data,
    aiQ.dataUpdatedAt,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [operationFailed, setOperationFailed] = useState(false);
  const mutations = useAiProviderMutations({
    trpc,
    onActivationPendingChange,
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
      <AiProviderLoadError
        isFetching={aiQ.isFetching}
        onRetry={() => void aiQ.refetch()}
      />
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
