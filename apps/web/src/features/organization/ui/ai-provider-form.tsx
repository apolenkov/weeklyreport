"use client";

import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
  AiProviderDraft,
  AiProviderProfile,
} from "@customreport/shared";
import { useState } from "react";

import {
  AiProviderConfigurationFields,
  type AiProviderFormState,
  CUSTOM_PROVIDER_PROFILE,
} from "./ai-provider-configuration-fields";

type RevisionRead =
  NonNullable<AiProviderControlRead["active"]> | AiProviderConfigurationRead;

const INITIAL_AI_PROVIDER_FORM: AiProviderFormState = {
  profile: "mistral",
  baseUrl: "",
  plannerModel: "",
  answerModel: "",
  embeddingModel: "",
  credential: "",
};

export const profileLabel = (profile: AiProviderProfile): string => {
  if (profile === CUSTOM_PROVIDER_PROFILE) return "Custom OpenAI-compatible";
  return profile === "mistral" ? "Mistral" : "OpenRouter";
};

export const toAiProviderForm = (
  active: RevisionRead | null,
): AiProviderFormState => ({
  profile: active?.profile ?? INITIAL_AI_PROVIDER_FORM.profile,
  baseUrl: active?.baseUrl ?? "",
  plannerModel: active?.plannerModel ?? "",
  answerModel: active?.answerModel ?? "",
  embeddingModel: active?.embeddingModel ?? "",
  credential: "",
});

const toAiProviderDraft = (form: AiProviderFormState): AiProviderDraft => ({
  profile: form.profile,
  ...(form.profile === CUSTOM_PROVIDER_PROFILE && form.baseUrl.trim().length > 0
    ? { baseUrl: form.baseUrl }
    : {}),
  plannerModel: form.plannerModel,
  answerModel: form.answerModel,
  embeddingModel: form.embeddingModel,
  ...(form.credential.length > 0 ? { credential: form.credential } : {}),
});

type AiProviderFormProps = Readonly<{
  initial: AiProviderFormState;
  revision: RevisionRead | null;
  revisionId: string | null;
  availability: AiProviderControlRead["availability"];
  busy: boolean;
  savePending: boolean;
  testPending: boolean;
  activatePending: boolean;
  disablePending: boolean;
  onSave: (draft: AiProviderDraft) => void;
  onTest: (revisionId: string) => void;
  onActivate: (revisionId: string) => void;
  onDisable: () => void;
}>;

function AiProviderActions({
  revision,
  revisionId,
  availability,
  busy,
  savePending,
  testPending,
  activatePending,
  disablePending,
  onTest,
  onActivate,
  onDisable,
}: Omit<AiProviderFormProps, "initial" | "onSave">) {
  const nextAction = revisionId
    ? "Test this saved draft before making it active."
    : "Save a draft first. It will not affect anyone yet.";

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {nextAction}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
        >
          {savePending ? "Saving…" : "Save draft"}
        </button>
        {revisionId && (
          <button
            type="button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-5 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={() => onTest(revisionId)}
          >
            {testPending ? "Testing…" : "Test capabilities"}
          </button>
        )}
        {revision?.lifecycle === "validated" && (
          <button
            type="button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Activate this AI provider globally?")) {
                onActivate(revision.id);
              }
            }}
          >
            {activatePending ? "Activating…" : "Activate"}
          </button>
        )}
        {availability === "available" && (
          <button
            type="button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-5 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Disable AI for all users?")) onDisable();
            }}
          >
            {disablePending ? "Disabling…" : "Disable"}
          </button>
        )}
      </div>
    </div>
  );
}

export function AiProviderForm({
  initial,
  onSave,
  ...props
}: AiProviderFormProps) {
  const [form, setForm] = useState<AiProviderFormState>(initial);

  return (
    <form
      className="mt-6 space-y-6"
      aria-busy={props.busy}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(toAiProviderDraft(form));
      }}
    >
      <AiProviderConfigurationFields
        form={form}
        busy={props.busy}
        credentialMaskedSuffix={props.revision?.credentialMaskedSuffix}
        onChange={(key, value) => {
          if (key === "profile") {
            setForm((current) => ({
              ...current,
              profile: value as AiProviderProfile,
              baseUrl: "",
            }));
            return;
          }
          setForm((current) => ({ ...current, [key]: value }));
        }}
      />
      <AiProviderActions {...props} />
    </form>
  );
}
