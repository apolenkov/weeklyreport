"use client";

import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
  AiProviderDraft,
} from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "../../../lib/trpc-context";
import {
  AiProviderForm,
  profileLabel,
  toAiProviderForm,
} from "./ai-provider-form";
import { useAiProviderMutations } from "./ai-provider-mutations";
import { AiProviderRetainedRevisions } from "./ai-provider-retained-revisions";
import { selectDisplayedRevision } from "./ai-provider-revision-selection";

type AiProviderMutations = ReturnType<typeof useAiProviderMutations>;

type AiProviderCardContentProps = Readonly<{
  data: AiProviderControlRead;
  savedRevision: AiProviderConfigurationRead | null;
  message: string | null;
  mutations: AiProviderMutations;
  onSave: (draft: AiProviderDraft) => void;
}>;

function AiProviderCardHeader({
  availability,
}: Readonly<{ availability: AiProviderControlRead["availability"] }>) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-starbucks-accent)] uppercase">
          AI integration
        </p>
        <h3 className="mt-1 text-lg font-semibold text-[var(--color-foreground)]">
          AI provider
        </h3>
        <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-muted-foreground)]">
          Configure the provider used by the Lead assistant and semantic index.
          A saved draft is isolated until you test and activate it.
        </p>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-2 self-start rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--color-foreground)]"
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
    </div>
  );
}

function AiProviderCardFeedback({
  revision,
  message,
  mutations,
}: Readonly<{
  revision: AiProviderControlRead["active"] | AiProviderConfigurationRead;
  message: string | null;
  mutations: AiProviderMutations;
}>) {
  return (
    <>
      {revision?.lifecycle === "preparing" && (
        <p
          className="mt-5 border-l-2 border-[var(--color-starbucks-accent)] pl-3 text-sm text-[var(--color-muted-foreground)]"
          data-testid="ai-preparation-progress"
        >
          Preparation: {revision.progress.completed}/{revision.progress.total}{" "}
          complete; {revision.progress.failed} failed; elapsed{" "}
          {revision.progress.elapsedMs} ms.
        </p>
      )}
      {message && (
        <p
          className="mt-5 border-l-2 border-[var(--color-starbucks-accent)] pl-3 text-sm text-[var(--color-muted-foreground)]"
          role="status"
        >
          {message}
        </p>
      )}
      <AiProviderOperationError
        message={message}
        visible={
          mutations.save.isError ||
          mutations.test.isError ||
          mutations.activate.isError ||
          mutations.disable.isError ||
          mutations.restore.isError
        }
      />
    </>
  );
}

function AiProviderCardContent({
  data,
  savedRevision,
  message,
  mutations,
  onSave,
}: AiProviderCardContentProps) {
  const displayedRevision = selectDisplayedRevision(data);
  const revisionId = savedRevision?.id ?? displayedRevision?.id ?? null;
  const revision = savedRevision ?? displayedRevision;
  const busy =
    mutations.save.isPending ||
    mutations.test.isPending ||
    mutations.activate.isPending ||
    mutations.disable.isPending ||
    mutations.restore.isPending;

  return (
    <div
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6"
      data-testid="integration-row-ai"
    >
      <AiProviderCardHeader availability={data.availability} />

      <AiProviderForm
        key={revisionId ?? "new"}
        initial={toAiProviderForm(revision)}
        revision={revision}
        revisionId={revisionId}
        availability={data.availability}
        busy={busy}
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
        message={message}
        mutations={mutations}
      />
      {revision && <AiProviderRevisionDetails revision={revision} />}
      <AiProviderRetainedRevisions
        revisions={data.revisions}
        activeRevisionId={data.activeRevisionId}
        busy={busy}
        restorePending={mutations.restore.isPending}
        onRestore={(id) => mutations.restore.mutate({ revisionId: id })}
      />
    </div>
  );
}

function AiProviderOperationError({
  message,
  visible,
}: Readonly<{ message: string | null; visible: boolean }>) {
  if (!visible) return null;
  return (
    <p className="mt-3 text-xs text-red-600" role="alert">
      {message ?? "AI provider operation failed."}
    </p>
  );
}

function AiProviderRevisionDetails({
  revision,
}: Readonly<{
  revision: NonNullable<AiProviderControlRead["active"]>;
}>) {
  return (
    <dl className="mt-6 grid gap-4 border-t border-[var(--color-border)] pt-5 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-xs font-semibold tracking-[0.1em] text-[var(--color-muted-foreground)] uppercase">
          Profile
        </dt>
        <dd
          data-testid="integration-ai-provider"
          className="mt-1 font-medium text-[var(--color-foreground)]"
        >
          {profileLabel(revision.profile)}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-[0.1em] text-[var(--color-muted-foreground)] uppercase">
          Credential
        </dt>
        <dd
          data-testid="integration-ai-credential"
          className="mt-1 font-mono text-[var(--color-foreground)]"
        >
          {revision.credentialMaskedSuffix ?? "not configured"}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-[0.1em] text-[var(--color-muted-foreground)] uppercase">
          Embeddings
        </dt>
        <dd
          data-testid="integration-ai-rag"
          className="mt-1 font-mono text-[var(--color-foreground)]"
        >
          {revision.embeddingModel} / {revision.embeddingDimensions}
        </dd>
      </div>
    </dl>
  );
}

export function AiProviderCard() {
  const trpc = useTRPC();
  const aiQ = useQuery(trpc.admin.aiProvider.get.queryOptions());
  const [savedRevision, setSavedRevision] =
    useState<AiProviderConfigurationRead | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mutations = useAiProviderMutations({
    trpc,
    refresh: () => {
      void aiQ.refetch();
    },
    setSavedRevision,
    setMessage,
  });

  if (aiQ.isLoading) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Loading AI configuration…
      </p>
    );
  }
  if (aiQ.isError || !aiQ.data) {
    return <p className="text-red-600">Failed to load AI configuration.</p>;
  }
  return (
    <AiProviderCardContent
      data={aiQ.data}
      savedRevision={savedRevision}
      message={message}
      mutations={mutations}
      onSave={(draft) => mutations.save.mutate(draft)}
    />
  );
}
