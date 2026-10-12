import type {
  AiProviderConnectionRole,
  AiProviderProfileCapability,
} from "@customreport/shared";
import type { RefObject } from "react";

import {
  EmbeddingFields,
  GenerationFields,
} from "./ai-provider-configuration-fields.sections";
import { type AiProviderFormState } from "./ai-provider-configuration-fields.types";

export type { AiProviderFormState } from "./ai-provider-configuration-fields.types";
type ConfigurationFieldsProps = Readonly<{
  form: AiProviderFormState;
  busy: boolean;
  profileCapabilities: readonly AiProviderProfileCapability[];
  generationCredentialConfigured: boolean;
  embeddingCredentialConfigured: boolean;
  onGenerationChange: (value: AiProviderFormState["generation"]) => void;
  onEmbeddingsChange: (value: AiProviderFormState["embeddings"]) => void;
  reasoningInvalid: boolean;
  reasoningErrorId: string;
  reasoningRef: RefObject<HTMLInputElement | null>;
}>;

const roleProfiles = (
  capabilities: readonly AiProviderProfileCapability[],
  role: AiProviderConnectionRole,
) =>
  capabilities
    .filter(({ roles }) => roles.includes(role))
    .map(({ profile }) => profile);

export function AiProviderConfigurationFields({
  form,
  busy,
  profileCapabilities,
  generationCredentialConfigured,
  embeddingCredentialConfigured,
  onGenerationChange,
  onEmbeddingsChange,
  reasoningInvalid,
  reasoningErrorId,
  reasoningRef,
}: ConfigurationFieldsProps) {
  const generationProfiles = roleProfiles(profileCapabilities, "generation");
  const embeddingProfiles = roleProfiles(profileCapabilities, "embeddings");
  const requiresSeparateEmbeddings = !embeddingProfiles.includes(
    form.generation.profile,
  );
  return (
    <div
      className="grid gap-4 lg:grid-cols-2 lg:items-stretch"
      data-testid="ai-provider-configuration-layout"
    >
      <div data-testid="ai-provider-generation-column">
        <GenerationFields
          form={form.generation}
          busy={busy}
          profiles={generationProfiles}
          credentialConfigured={generationCredentialConfigured}
          onChange={onGenerationChange}
          reasoningInvalid={reasoningInvalid}
          reasoningErrorId={reasoningErrorId}
          reasoningRef={reasoningRef}
        />
      </div>
      <div data-testid="ai-provider-embeddings-column">
        <EmbeddingFields
          form={form.embeddings}
          busy={busy}
          profiles={embeddingProfiles}
          requiresSeparateEmbeddings={requiresSeparateEmbeddings}
          credentialConfigured={embeddingCredentialConfigured}
          onChange={onEmbeddingsChange}
        />
      </div>
    </div>
  );
}
