import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
} from "@customreport/shared";

import { useAiProviderMutations } from "./ai-provider-mutations";
import { AiProviderOperationError } from "./ai-provider-operation-error";

type AiProviderMutations = ReturnType<typeof useAiProviderMutations>;

const capabilityStatusLabel = (
  status: "passed" | "failed" | "inconclusive",
): string =>
  status === "passed"
    ? "Passed"
    : status === "failed"
      ? "Failed"
      : "Inconclusive";

export function AiProviderCardFeedback({
  revision,
  message,
  mutations,
}: Readonly<{
  revision: AiProviderControlRead["active"] | AiProviderConfigurationRead;
  message: string | null;
  mutations: AiProviderMutations;
}>) {
  const capabilityResult = revision?.testResult;
  const embeddingStatus = capabilityResult
    ? revision.embeddings.mode === "reuse_generation"
      ? capabilityResult.generation.status
      : capabilityResult.embeddings.status
    : null;
  return (
    <>
      {capabilityResult && (
        <div
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3 py-2 text-xs sm:text-sm"
          data-testid="ai-capability-results"
          aria-label="AI provider capability results"
        >
          <p className="inline-flex items-center gap-1.5">
            <span className="font-semibold">Generation:</span>{" "}
            {capabilityStatusLabel(capabilityResult.generation.status)}
          </p>
          <p className="inline-flex items-center gap-1.5">
            <span className="font-semibold">Embeddings:</span>{" "}
            {revision.embeddings.mode === "reuse_generation"
              ? `Same connection as Generation · ${capabilityStatusLabel(embeddingStatus ?? "inconclusive")}`
              : capabilityStatusLabel(embeddingStatus ?? "inconclusive")}
          </p>
        </div>
      )}
      {revision?.lifecycle === "preparing" && (
        <p
          className="mt-4 border-l-2 border-[var(--color-starbucks-accent)] pl-3 text-sm text-[var(--color-muted-foreground)]"
          data-testid="ai-preparation-progress"
        >
          Preparation: {revision.progress.completed}/{revision.progress.total}{" "}
          complete; {revision.progress.failed} failed; elapsed{" "}
          {revision.progress.elapsedMs} ms.
        </p>
      )}
      {message && (
        <p
          className="mt-4 border-l-2 border-[var(--color-starbucks-accent)] pl-3 text-sm text-[var(--color-muted-foreground)]"
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
          mutations.restore.isError ||
          mutations.discard.isError
        }
      />
    </>
  );
}
