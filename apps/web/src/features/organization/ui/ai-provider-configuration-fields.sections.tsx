import type {
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@weeklyreport/shared";
import type { RefObject } from "react";

import {
  CredentialField,
  EndpointField,
  Field,
  FIELD_CLASS,
  ProfileField,
  SectionHeading,
} from "./ai-provider-configuration-fields.controls";
import {
  type AiProviderFormState,
  CUSTOM_PROVIDER_PROFILE,
} from "./ai-provider-configuration-fields.types";

function fieldUpdater<T extends object>(form: T, onChange: (value: T) => void) {
  return <K extends keyof T>(key: K, value: T[K]) =>
    onChange({ ...form, [key]: value });
}

function GenerationModelFields({
  form,
  busy,
  onChange,
}: Readonly<{
  form: AiProviderFormState["generation"];
  busy: boolean;
  onChange: (value: AiProviderFormState["generation"]) => void;
}>) {
  const update = fieldUpdater(form, onChange);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Planner model">
        <input
          name="generation.plannerModel"
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
          name="generation.answerModel"
          aria-label="Answer model"
          className={FIELD_CLASS}
          value={form.answerModel}
          onChange={(event) => update("answerModel", event.target.value)}
          disabled={busy}
          placeholder="Provider model ID"
        />
      </Field>
    </div>
  );
}

function GenerationReasoningFields({
  form,
  busy,
  onChange,
  reasoningInvalid,
  reasoningErrorId,
  reasoningRef,
}: Readonly<{
  form: AiProviderFormState["generation"];
  busy: boolean;
  onChange: (value: AiProviderFormState["generation"]) => void;
  reasoningInvalid: boolean;
  reasoningErrorId: string;
  reasoningRef: RefObject<HTMLInputElement | null>;
}>) {
  const update = fieldUpdater(form, onChange);
  return (
    <>
      <Field label="Reasoning" hint="Verified during provider testing.">
        <select
          name="generation.reasoningMode"
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
            ref={reasoningRef}
            name="generation.reasoningCustomValue"
            aria-label="Custom reasoning value"
            className={FIELD_CLASS}
            value={form.reasoningCustomValue}
            onChange={(event) =>
              update("reasoningCustomValue", event.target.value)
            }
            disabled={busy}
            maxLength={64}
            aria-invalid={reasoningInvalid || undefined}
            aria-describedby={reasoningInvalid ? reasoningErrorId : undefined}
          />
        </Field>
      )}
    </>
  );
}

export function GenerationFields({
  form,
  busy,
  profiles,
  credentialConfigured,
  onChange,
  reasoningInvalid,
  reasoningErrorId,
  reasoningRef,
}: Readonly<{
  form: AiProviderFormState["generation"];
  busy: boolean;
  profiles: readonly AiProviderProfile[];
  credentialConfigured: boolean;
  onChange: (value: AiProviderFormState["generation"]) => void;
  reasoningInvalid: boolean;
  reasoningErrorId: string;
  reasoningRef: RefObject<HTMLInputElement | null>;
}>) {
  const update = fieldUpdater(form, onChange);
  return (
    <section
      className="flex h-full flex-col gap-4 rounded-[var(--radius)] bg-[var(--color-surface-hover)]/60 p-4 sm:p-5"
      data-testid="ai-provider-generation-section"
    >
      <SectionHeading
        eyebrow="01"
        title="Generation"
        description="Planner and answer models."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfileField
          connectionRole="generation"
          value={form.profile}
          profiles={profiles}
          busy={busy}
          onChange={(profile) => update("profile", profile)}
        />
        {form.profile === CUSTOM_PROVIDER_PROFILE && (
          <EndpointField
            connectionRole="generation"
            baseUrl={form.baseUrl}
            busy={busy}
            onChange={(baseUrl) => update("baseUrl", baseUrl)}
          />
        )}
      </div>
      <GenerationModelFields form={form} busy={busy} onChange={onChange} />
      <GenerationReasoningFields
        form={form}
        busy={busy}
        onChange={onChange}
        reasoningInvalid={reasoningInvalid}
        reasoningErrorId={reasoningErrorId}
        reasoningRef={reasoningRef}
      />
      <CredentialField
        label="Generation credential"
        value={form.credential}
        configured={credentialConfigured}
        busy={busy}
        onChange={(credential) => update("credential", credential)}
      />
    </section>
  );
}

function SeparateEmbeddingConnection({
  form,
  busy,
  profiles,
  credentialConfigured,
  onChange,
}: Readonly<{
  form: AiProviderFormState["embeddings"];
  busy: boolean;
  profiles: readonly AiProviderProfile[];
  credentialConfigured: boolean;
  onChange: (value: AiProviderFormState["embeddings"]) => void;
}>) {
  const update = fieldUpdater(form, onChange);
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfileField
          connectionRole="embeddings"
          value={form.profile}
          profiles={profiles}
          busy={busy}
          onChange={(profile) => update("profile", profile)}
        />
        {form.profile === CUSTOM_PROVIDER_PROFILE && (
          <EndpointField
            connectionRole="embeddings"
            baseUrl={form.baseUrl}
            busy={busy}
            onChange={(baseUrl) => update("baseUrl", baseUrl)}
          />
        )}
      </div>
      <CredentialField
        label="Embeddings credential"
        value={form.credential}
        configured={credentialConfigured}
        busy={busy}
        onChange={(credential) => update("credential", credential)}
      />
    </div>
  );
}

export function EmbeddingFields({
  form,
  busy,
  profiles,
  requiresSeparateEmbeddings,
  credentialConfigured,
  onChange,
}: Readonly<{
  form: AiProviderFormState["embeddings"];
  busy: boolean;
  profiles: readonly AiProviderProfile[];
  requiresSeparateEmbeddings: boolean;
  credentialConfigured: boolean;
  onChange: (value: AiProviderFormState["embeddings"]) => void;
}>) {
  const update = fieldUpdater(form, onChange);
  return (
    <section
      className="flex h-full flex-col gap-4 rounded-[var(--radius)] bg-[var(--color-surface-hover)]/60 p-4 sm:p-5"
      data-testid="ai-provider-embeddings-section"
    >
      <SectionHeading
        eyebrow="02"
        title="Embeddings"
        description="Model used for semantic search."
      />
      <Field
        label="Embedding connection"
        {...(requiresSeparateEmbeddings
          ? {
              hint: "The selected generation provider does not support embeddings. Configure a separate embedding provider.",
            }
          : {})}
      >
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
          disabled={busy || requiresSeparateEmbeddings}
        >
          {!requiresSeparateEmbeddings && (
            <option value="reuse_generation">Use generation connection</option>
          )}
          <option value="separate">Separate connection</option>
        </select>
      </Field>
      <Field label="Embedding model">
        <input
          name="embeddings.model"
          aria-label="Embedding model"
          className={FIELD_CLASS}
          value={form.model}
          onChange={(event) => update("model", event.target.value)}
          disabled={busy}
          placeholder="Provider embedding model ID"
        />
      </Field>
      {form.mode === "separate" && (
        <SeparateEmbeddingConnection
          form={form}
          busy={busy}
          profiles={profiles}
          credentialConfigured={credentialConfigured}
          onChange={onChange}
        />
      )}
    </section>
  );
}
