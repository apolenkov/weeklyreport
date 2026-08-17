import type { AiProviderControlRead } from "@customreport/shared";

import { profileLabel } from "./ai-provider-form";

const answerProtocolLabel = (
  value: NonNullable<
    AiProviderControlRead["active"]
  >["generation"]["answerProtocol"],
): string =>
  value === "json_schema"
    ? "JSON Schema"
    : value === "forced_tool"
      ? "Forced tool"
      : "Not detected";

export function AiProviderRevisionDetails({
  revision,
}: Readonly<{ revision: NonNullable<AiProviderControlRead["active"]> }>) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-xs font-semibold tracking-[0.1em] text-[var(--color-muted-foreground)] uppercase">
          Profile
        </dt>
        <dd
          data-testid="integration-ai-provider"
          className="mt-1 font-medium text-[var(--color-foreground)]"
        >
          {profileLabel(revision.generation.profile)}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-[0.1em] text-[var(--color-muted-foreground)] uppercase">
          Generation credential
        </dt>
        <dd
          data-testid="integration-ai-credential"
          className="mt-1 font-mono text-[var(--color-foreground)]"
        >
          {revision.generation.credentialMaskedSuffix ?? "not configured"}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-[0.1em] text-[var(--color-muted-foreground)] uppercase">
          Answer protocol
        </dt>
        <dd
          data-testid="integration-ai-answer-protocol"
          className="mt-1 font-medium text-[var(--color-foreground)]"
        >
          {answerProtocolLabel(revision.generation.answerProtocol)}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-[0.1em] text-[var(--color-muted-foreground)] uppercase">
          Embeddings connection
        </dt>
        <dd className="mt-1 font-medium text-[var(--color-foreground)]">
          {revision.embeddings.mode === "reuse_generation"
            ? "Same connection as generation"
            : profileLabel(revision.embeddings.profile)}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-[0.1em] text-[var(--color-muted-foreground)] uppercase">
          Embeddings credential
        </dt>
        <dd
          data-testid="integration-ai-rag"
          className="mt-1 font-mono text-[var(--color-foreground)]"
        >
          {revision.embeddings.mode === "reuse_generation"
            ? "Uses generation credential"
            : (revision.embeddings.credentialMaskedSuffix ?? "not configured")}
          <span className="ml-2 font-sans text-[var(--color-muted-foreground)]">
            · {revision.embeddings.model} / {revision.embeddings.dimensions}
          </span>
        </dd>
      </div>
    </dl>
  );
}
