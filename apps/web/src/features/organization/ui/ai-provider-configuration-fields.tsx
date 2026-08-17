import type {
  AiProviderConnectionRole,
  AiProviderProfileCapability,
} from "@customreport/shared";

import {
  EmbeddingFields,
  GenerationFields,
} from "./ai-provider-configuration-fields.sections";
import { type AiProviderFormState } from "./ai-provider-configuration-fields.types";

export type { AiProviderFormState } from "./ai-provider-configuration-fields.types";
export { CUSTOM_PROVIDER_PROFILE } from "./ai-provider-configuration-fields.types";

type ConfigurationFieldsProps = Readonly<{
  form: AiProviderFormState;
  busy: boolean;
  profileCapabilities: readonly AiProviderProfileCapability[];
  generationCredentialMaskedSuffix: string | null | undefined;
  embeddingCredentialMaskedSuffix: string | null | undefined;
  onChange: <K extends keyof AiProviderFormState>(
    key: K,
    value: AiProviderFormState[K],
  ) => void;
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
  generationCredentialMaskedSuffix,
  embeddingCredentialMaskedSuffix,
  onChange,
}: ConfigurationFieldsProps) {
  const generationProfiles = roleProfiles(profileCapabilities, "generation");
  const embeddingProfiles = roleProfiles(profileCapabilities, "embeddings");
  return (
    <div
      className="grid gap-5 lg:grid-cols-12 lg:items-start"
      data-testid="ai-provider-configuration-layout"
    >
      <div
        className="lg:col-span-7"
        data-testid="ai-provider-generation-column"
      >
        <GenerationFields
          form={form.generation}
          busy={busy}
          profiles={generationProfiles}
          credentialMaskedSuffix={generationCredentialMaskedSuffix}
          onChange={(generation) => onChange("generation", generation)}
        />
      </div>
      <div
        className="lg:col-span-5"
        data-testid="ai-provider-embeddings-column"
      >
        <EmbeddingFields
          form={form.embeddings}
          busy={busy}
          profiles={embeddingProfiles}
          credentialMaskedSuffix={embeddingCredentialMaskedSuffix}
          onChange={(embeddings) => onChange("embeddings", embeddings)}
        />
      </div>
    </div>
  );
}
