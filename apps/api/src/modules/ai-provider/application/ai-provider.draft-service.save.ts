import { randomUUID } from "node:crypto";

import {
  type AiProviderConfigurationRead,
  type AiProviderDraft,
  aiProviderDraftSchema,
} from "@customreport/shared";

import { resolveProviderProfile } from "../domain/provider-profile.js";
import {
  buildDraftIdentities,
  buildNewRevision,
  credentialSourceFor,
  resolveDraftCredentials,
} from "./ai-provider.draft-service.save-support.js";
import {
  type AiProviderServiceDependencies,
  safeRevision,
} from "./ai-provider.service-support.js";

export const saveAiProviderDraft = async (
  dependencies: AiProviderServiceDependencies,
  input: AiProviderDraft,
  actorId: string,
): Promise<AiProviderConfigurationRead> => {
  const draft = aiProviderDraftSchema.parse(input);
  const profile = resolveProviderProfile(
    draft,
    dependencies.env.AI_PROVIDER_ALLOWED_ORIGINS,
    dependencies.env.REPORT_ASSISTANT_INPUT_VERSION,
  );
  const revisionId = randomUUID();
  const control = await dependencies.repository.getControl();
  const active = control?.activeConfiguration ?? null;
  const credentialSource = await credentialSourceFor(
    dependencies,
    draft.baseRevisionId,
    active,
  );
  const credentials = resolveDraftCredentials({
    dependencies,
    draft,
    profile,
    credentialSource,
    revisionId,
  });
  const identities = buildDraftIdentities({
    dependencies,
    profile,
    credentials,
    revisionId,
  });
  const revision = await dependencies.repository.createDraft(
    buildNewRevision({ profile, credentials, identities, revisionId }),
  );
  dependencies.audit.record({
    event: "ai_provider.draft_saved",
    actorId,
    revisionId: revision.id,
    generationProfile: draft.generation.profile,
    embeddingMode: draft.embeddings.mode,
  });
  return safeRevision(revision, dependencies.codec);
};
