import type {
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@customreport/shared";

import {
  CredentialField,
  EndpointField,
  Field,
  FIELD_CLASS,
  ProfileField,
  SectionHeading,
} from "./ai-provider-configuration-fields.controls";
import type { AiProviderFormState } from "./ai-provider-configuration-fields.types";

export function GenerationFields({
  form,
  busy,
  profiles,
  credentialMaskedSuffix,
  onChange,
}: Readonly<{
  form: AiProviderFormState["generation"];
  busy: boolean;
  profiles: readonly AiProviderProfile[];
  credentialMaskedSuffix: string | null | undefined;
  onChange: (value: AiProviderFormState["generation"]) => void;
}>) {
  const update = <K extends keyof AiProviderFormState["generation"]>(
    key: K,
    value: AiProviderFormState["generation"][K],
  ) => onChange({ ...form, [key]: value });
  return (
    <section
      className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4"
      data-testid="ai-provider-generation-section"
    >
      <SectionHeading
        eyebrow="01 · Generation"
        title="Configure planner and answer generation"
        description="One generation connection serves planning, repair, answers, and citation repair."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfileField
          connectionRole="generation"
          value={form.profile}
          profiles={profiles}
          busy={busy}
          onChange={(profile) => update("profile", profile)}
        />
        <EndpointField
          profile={form.profile}
          baseUrl={form.baseUrl}
          busy={busy}
          label="Generation endpoint"
          onChange={(baseUrl) => update("baseUrl", baseUrl)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Planner model">
          <input
            aria-label="Planner model"
            className={FIELD_CLASS}
            value={form.plannerModel}
            onChange={(event) => update("plannerModel", event.target.value)}
            disabled={busy}
            placeholder="Provider model ID"
          />
        </Field>
        <Field label="Answer model">
          <input
            aria-label="Answer model"
            className={FIELD_CLASS}
            value={form.answerModel}
            onChange={(event) => update("answerModel", event.target.value)}
            disabled={busy}
            placeholder="Provider model ID"
          />
        </Field>
      </div>
      <Field
        label="Reasoning"
        hint="Provider testing validates this setting with the generation capabilities."
      >
        <select
          aria-label="Generation reasoning"
          className={FIELD_CLASS}
          value={form.reasoningMode}
          onChange={(event) =>
            update(
              "reasoningMode",
              event.target.value as AiProviderReasoningMode,
            )
          }
          disabled={busy}
        >
          <option value="provider_default">Provider default</option>
          <option value="off">Off</option>
          <option value="custom">Custom</option>
        </select>
      </Field>
      {form.reasoningMode === "custom" && (
        <Field label="Custom reasoning value">
          <input
            aria-label="Custom reasoning value"
            className={FIELD_CLASS}
            value={form.reasoningCustomValue}
            onChange={(event) =>
              update("reasoningCustomValue", event.target.value)
            }
            disabled={busy}
            maxLength={64}
          />
        </Field>
      )}
      <CredentialField
        label="Generation credential"
        value={form.credential}
        maskedSuffix={credentialMaskedSuffix}
        busy={busy}
        onChange={(credential) => update("credential", credential)}
      />
    </section>
  );
}

export function EmbeddingFields({
  form,
  busy,
  profiles,
  credentialMaskedSuffix,
  onChange,
}: Readonly<{
  form: AiProviderFormState["embeddings"];
  busy: boolean;
  profiles: readonly AiProviderProfile[];
  credentialMaskedSuffix: string | null | undefined;
  onChange: (value: AiProviderFormState["embeddings"]) => void;
}>) {
  const update = <K extends keyof AiProviderFormState["embeddings"]>(
    key: K,
    value: AiProviderFormState["embeddings"][K],
  ) => onChange({ ...form, [key]: value });
  return (
    <section
      className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4"
      data-testid="ai-provider-embeddings-section"
    >
      <SectionHeading
        eyebrow="02 · Embeddings"
        title="Configure semantic retrieval"
        description="Use the generation connection or reveal a separate embedding connection. Dimensions are measured by capability testing."
      />
      <Field label="Embedding connection">
        <select
          aria-label="Embedding connection mode"
          className={FIELD_CLASS}
          value={form.mode}
          onChange={(event) =>
            update(
              "mode",
              event.target.value as AiProviderFormState["embeddings"]["mode"],
            )
          }
          disabled={busy}
        >
          <option value="reuse_generation">
            Same connection as generation
          </option>
          <option value="separate">Separate connection</option>
        </select>
      </Field>
      <Field label="Embedding model">
        <input
          aria-label="Embedding model"
          className={FIELD_CLASS}
          value={form.model}
          onChange={(event) => update("model", event.target.value)}
          disabled={busy}
          placeholder="Provider embedding model ID"
        />
      </Field>
      {form.mode === "separate" && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileField
              connectionRole="embeddings"
              value={form.profile}
              profiles={profiles}
              busy={busy}
              onChange={(profile) => update("profile", profile)}
            />
            <EndpointField
              profile={form.profile}
              baseUrl={form.baseUrl}
              busy={busy}
              label="Embeddings endpoint"
              onChange={(baseUrl) => update("baseUrl", baseUrl)}
            />
          </div>
          <CredentialField
            label="Embeddings credential"
            value={form.credential}
            maskedSuffix={credentialMaskedSuffix}
            busy={busy}
            onChange={(credential) => update("credential", credential)}
          />
        </div>
      )}
    </section>
  );
}
