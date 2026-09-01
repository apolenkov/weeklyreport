"use client";

import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
  AiProviderDraft,
  AiProviderProfile,
  AiProviderProfileCapability,
} from "@customreport/shared";
import { useId, useRef, useState } from "react";

import {
  AiProviderConfigurationFields,
  type AiProviderFormState,
  CUSTOM_PROVIDER_PROFILE,
} from "./ai-provider-configuration-fields";
import { AiProviderActions } from "./ai-provider-form-actions";

type RevisionRead = AiProviderConfigurationRead;

const INITIAL_AI_PROVIDER_FORM: AiProviderFormState = {
  generation: {
    profile: "mistral",
    baseUrl: "",
    plannerModel: "mistral-large-latest",
    answerModel: "mistral-large-latest",
    reasoningMode: "provider_default",
    reasoningCustomValue: "",
    credential: "",
  },
  embeddings: {
    mode: "reuse_generation",
    profile: "mistral",
    baseUrl: "",
    model: "mistral-embed",
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

const toGenerationDraft = (
  form: AiProviderFormState["generation"],
): AiProviderDraft["generation"] => {
  const generation = {
    profile: form.profile,
    plannerModel: form.plannerModel,
    answerModel: form.answerModel,
    reasoningMode: form.reasoningMode,
  } as AiProviderDraft["generation"];
  if (form.profile === CUSTOM_PROVIDER_PROFILE && form.baseUrl.trim()) {
    generation.baseUrl = form.baseUrl;
  }
  if (form.reasoningMode === "custom") {
    generation.reasoningCustomValue = form.reasoningCustomValue.trim();
  }
  if (form.credential) generation.credential = form.credential;
  return generation;
};

const toEmbeddingsDraft = (
  form: AiProviderFormState["embeddings"],
): AiProviderDraft["embeddings"] => {
  if (form.mode === "reuse_generation") {
    return { mode: "reuse_generation", model: form.model };
  }
  const embeddings: Extract<
    AiProviderDraft["embeddings"],
    { mode: "separate" }
  > = {
    mode: "separate" as const,
    profile: form.profile,
    model: form.model,
  };
  if (form.profile === CUSTOM_PROVIDER_PROFILE && form.baseUrl.trim()) {
    embeddings.baseUrl = form.baseUrl;
  }
  if (form.credential) embeddings.credential = form.credential;
  return embeddings;
};

const toAiProviderDraft = (
  form: AiProviderFormState,
  baseRevisionId: string | null,
): AiProviderDraft => ({
  ...(baseRevisionId ? { baseRevisionId } : {}),
  generation: toGenerationDraft(form.generation),
  embeddings: toEmbeddingsDraft(form.embeddings),
});

const updateGeneration = (
  current: AiProviderFormState,
  value: AiProviderFormState["generation"],
  profileCapabilities: readonly AiProviderProfileCapability[],
): AiProviderFormState => ({
  ...current,
  generation: {
    ...value,
    baseUrl: value.profile === current.generation.profile ? value.baseUrl : "",
  },
  embeddings:
    current.embeddings.mode === "reuse_generation" &&
    !profileCapabilities.some(
      ({ profile, roles }) =>
        profile === value.profile && roles.includes("embeddings"),
    )
      ? { ...current.embeddings, mode: "separate" }
      : current.embeddings,
});

const updateEmbeddings = (
  current: AiProviderFormState,
  value: AiProviderFormState["embeddings"],
): AiProviderFormState => ({
  ...current,
  embeddings: {
    ...value,
    baseUrl: value.profile === current.embeddings.profile ? value.baseUrl : "",
  },
});

const updateFormState = <K extends keyof AiProviderFormState>(
  current: AiProviderFormState,
  key: K,
  value: AiProviderFormState[K],
  profileCapabilities: readonly AiProviderProfileCapability[],
): AiProviderFormState => {
  if (key === "generation") {
    return updateGeneration(
      current,
      value as AiProviderFormState["generation"],
      profileCapabilities,
    );
  }
  if (key === "embeddings") {
    return updateEmbeddings(
      current,
      value as AiProviderFormState["embeddings"],
    );
  }
  return { ...current, [key]: value };
};

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
  const reasoningErrorId = useId();
  const reasoningRef = useRef<HTMLInputElement>(null);

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
          reasoningRef.current?.focus();
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
        onChange={(key, value) =>
          setForm((current) =>
            updateFormState(current, key, value, props.profileCapabilities),
          )
        }
        reasoningInvalid={reasoningError !== null}
        reasoningErrorId={reasoningErrorId}
        reasoningRef={reasoningRef}
      />
      {reasoningError && (
        <p
          id={reasoningErrorId}
          className="text-sm text-[var(--color-destructive)]"
          role="alert"
        >
          {reasoningError}
        </p>
      )}
      <AiProviderActions {...props} />
    </form>
  );
}
