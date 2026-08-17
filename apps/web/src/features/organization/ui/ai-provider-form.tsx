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
import { AiProviderActions } from "./ai-provider-form-actions";

type RevisionRead =
  NonNullable<AiProviderControlRead["active"]> | AiProviderConfigurationRead;

const INITIAL_AI_PROVIDER_FORM: AiProviderFormState = {
  generation: {
    profile: "mistral",
    baseUrl: "",
    plannerModel: "",
    answerModel: "",
    reasoningMode: "provider_default",
    reasoningCustomValue: "",
    credential: "",
  },
  embeddings: {
    mode: "reuse_generation",
    profile: "mistral",
    baseUrl: "",
    model: "",
    credential: "",
  },
};

export const profileLabel = (profile: AiProviderProfile): string => {
  if (profile === CUSTOM_PROVIDER_PROFILE) return "Custom OpenAI-compatible";
  return profile === "openrouter"
    ? "OpenRouter"
    : profile.charAt(0).toUpperCase() + profile.slice(1);
};

export const toAiProviderForm = (
  active: RevisionRead | null,
): AiProviderFormState => ({
  generation: active
    ? {
        profile: active.generation.profile,
        baseUrl: active.generation.baseUrl,
        plannerModel: active.generation.plannerModel,
        answerModel: active.generation.answerModel,
        reasoningMode: active.generation.reasoningMode,
        reasoningCustomValue: active.generation.reasoningCustomValue ?? "",
        credential: "",
      }
    : INITIAL_AI_PROVIDER_FORM.generation,
  embeddings: active
    ? active.embeddings.mode === "reuse_generation"
      ? {
          mode: "reuse_generation",
          profile: active.generation.profile,
          baseUrl: "",
          model: active.embeddings.model,
          credential: "",
        }
      : {
          mode: "separate",
          profile: active.embeddings.profile,
          baseUrl: active.embeddings.baseUrl,
          model: active.embeddings.model,
          credential: "",
        }
    : INITIAL_AI_PROVIDER_FORM.embeddings,
});

const toAiProviderDraft = (
  form: AiProviderFormState,
  baseRevisionId: string | null,
): AiProviderDraft => ({
  ...(baseRevisionId ? { baseRevisionId } : {}),
  generation: {
    profile: form.generation.profile,
    ...(form.generation.profile === CUSTOM_PROVIDER_PROFILE &&
    form.generation.baseUrl.trim().length > 0
      ? { baseUrl: form.generation.baseUrl }
      : {}),
    plannerModel: form.generation.plannerModel,
    answerModel: form.generation.answerModel,
    reasoningMode: form.generation.reasoningMode,
    ...(form.generation.reasoningMode === "custom"
      ? { reasoningCustomValue: form.generation.reasoningCustomValue.trim() }
      : {}),
    ...(form.generation.credential.length > 0
      ? { credential: form.generation.credential }
      : {}),
  },
  embeddings:
    form.embeddings.mode === "reuse_generation"
      ? { mode: "reuse_generation", model: form.embeddings.model }
      : {
          mode: "separate",
          profile: form.embeddings.profile,
          ...(form.embeddings.profile === CUSTOM_PROVIDER_PROFILE &&
          form.embeddings.baseUrl.trim().length > 0
            ? { baseUrl: form.embeddings.baseUrl }
            : {}),
          model: form.embeddings.model,
          ...(form.embeddings.credential.length > 0
            ? { credential: form.embeddings.credential }
            : {}),
        },
});

type AiProviderFormProps = Readonly<{
  initial: AiProviderFormState;
  revision: RevisionRead | null;
  revisionId: string | null;
  availability: AiProviderControlRead["availability"];
  profileCapabilities: AiProviderControlRead["profileCapabilities"];
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

export function AiProviderForm({
  initial,
  onSave,
  ...props
}: AiProviderFormProps) {
  const [form, setForm] = useState<AiProviderFormState>(initial);
  const [reasoningError, setReasoningError] = useState<string | null>(null);

  return (
    <form
      className="mt-5 flex flex-col gap-5"
      aria-busy={props.busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (
          form.generation.reasoningMode === "custom" &&
          form.generation.reasoningCustomValue.trim().length === 0
        ) {
          setReasoningError("Enter a custom reasoning value.");
          return;
        }
        setReasoningError(null);
        onSave(toAiProviderDraft(form, props.revisionId));
      }}
    >
      <AiProviderConfigurationFields
        form={form}
        busy={props.busy}
        profileCapabilities={props.profileCapabilities}
        generationCredentialMaskedSuffix={
          props.revision?.generation.credentialMaskedSuffix
        }
        embeddingCredentialMaskedSuffix={
          props.revision?.embeddings.mode === "separate"
            ? props.revision.embeddings.credentialMaskedSuffix
            : undefined
        }
        onChange={(key, value) => {
          if (key === "generation") {
            setForm((current) => ({
              ...current,
              generation: {
                ...(value as AiProviderFormState["generation"]),
                baseUrl:
                  value.profile === current.generation.profile
                    ? value.baseUrl
                    : "",
              },
            }));
            return;
          }
          if (key === "embeddings") {
            setForm((current) => ({
              ...current,
              embeddings: {
                ...(value as AiProviderFormState["embeddings"]),
                baseUrl:
                  value.profile === current.embeddings.profile
                    ? value.baseUrl
                    : "",
              },
            }));
            return;
          }
          setForm((current) => ({ ...current, [key]: value }));
        }}
      />
      {reasoningError && (
        <p className="text-sm text-red-600" role="alert">
          {reasoningError}
        </p>
      )}
      <AiProviderActions {...props} />
    </form>
  );
}
