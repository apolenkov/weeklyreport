import type { AiProviderCapabilityTestResult } from "@customreport/shared";
import {
  AiProviderAnswerProtocol,
  AiProviderLifecycle,
  type AiProviderProfile,
  type AiProviderReasoningMode,
  type Prisma,
} from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { aiProviderRevisionSelect } from "./ai-provider.repository.select.js";
import type { EncryptedCredential } from "./credential-codec.js";

export type NewAiProviderRevision = Readonly<{
  id: string;
  generation: Readonly<{
    profile: AiProviderProfile;
    baseUrl: string;
    endpointIdentity: string;
    credential: EncryptedCredential;
  }>;
  plannerModel: string;
  answerModel: string;
  reasoningMode: AiProviderReasoningMode;
  reasoningCustomValue: string | null;
  embeddings:
    | Readonly<{
        mode: "reuse_generation";
        model: string;
        dimensions: number | null;
        semanticInputVersion: string;
      }>
    | Readonly<{
        mode: "separate";
        profile: AiProviderProfile;
        baseUrl: string;
        endpointIdentity: string;
        model: string;
        dimensions: number | null;
        semanticInputVersion: string;
        credential: EncryptedCredential;
      }>;
  generationCompatibilityIdentity: string;
  embeddingScopeIdentity: string;
  compositeTestIdentity: string;
}>;

export type AiProviderPreparationUpdate = Readonly<{
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lifecycle?: AiProviderLifecycle;
}>;

type SetTestResultInput = Readonly<{
  id: string;
  result: Prisma.InputJsonValue;
  status: AiProviderCapabilityTestResult["status"];
  embeddingDimensions: number | null;
  testedAt: Date;
  currentLifecycle: AiProviderLifecycle;
  generationCompatibilityIdentity?: string;
  embeddingScopeIdentity?: string;
  compositeTestIdentity?: string;
}>;

const answerProtocolFrom = (
  result: Prisma.InputJsonValue,
): AiProviderAnswerProtocol | null | undefined => {
  const value = result as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const object = value as Record<string, unknown>;
  const generation = object.generation;
  const protocol =
    generation && typeof generation === "object" && !Array.isArray(generation)
      ? (generation as Record<string, unknown>).answerProtocol
      : object.answerProtocol;
  if (protocol === undefined) return undefined;
  if (protocol === null) return null;
  return protocol === AiProviderAnswerProtocol.json_schema ||
    protocol === AiProviderAnswerProtocol.forced_tool ||
    protocol === AiProviderAnswerProtocol.json_object
    ? protocol
    : undefined;
};

export const createDraftRecord = (
  prisma: PrismaService,
  input: NewAiProviderRevision,
) =>
  prisma.$transaction(async (transaction) => {
    const created = await transaction.aiProviderConfiguration.create({
      data: {
        id: input.id,
        generationProfile: input.generation.profile,
        generationBaseUrl: input.generation.baseUrl,
        generationEndpointIdentity: input.generation.endpointIdentity,
        plannerModel: input.plannerModel,
        answerModel: input.answerModel,
        reasoningMode: input.reasoningMode,
        reasoningCustomValue: input.reasoningCustomValue,
        generationCredentialCiphertext: input.generation.credential.ciphertext,
        generationCredentialNonce: input.generation.credential.nonce,
        generationCredentialTag: input.generation.credential.tag,
        generationCredentialKeyVersion: input.generation.credential.keyVersion,
        generationCredentialMaskedSuffix:
          input.generation.credential.maskedSuffix,
        embeddingMode: input.embeddings.mode,
        embeddingProfile:
          input.embeddings.mode === "separate"
            ? input.embeddings.profile
            : null,
        embeddingBaseUrl:
          input.embeddings.mode === "separate"
            ? input.embeddings.baseUrl
            : null,
        embeddingEndpointIdentity:
          input.embeddings.mode === "separate"
            ? input.embeddings.endpointIdentity
            : null,
        embeddingModel: input.embeddings.model,
        embeddingDimensions: input.embeddings.dimensions,
        embeddingCredentialCiphertext:
          input.embeddings.mode === "separate"
            ? input.embeddings.credential.ciphertext
            : null,
        embeddingCredentialNonce:
          input.embeddings.mode === "separate"
            ? input.embeddings.credential.nonce
            : null,
        embeddingCredentialTag:
          input.embeddings.mode === "separate"
            ? input.embeddings.credential.tag
            : null,
        embeddingCredentialKeyVersion:
          input.embeddings.mode === "separate"
            ? input.embeddings.credential.keyVersion
            : null,
        embeddingCredentialMaskedSuffix:
          input.embeddings.mode === "separate"
            ? input.embeddings.credential.maskedSuffix
            : null,
        semanticInputVersion: input.embeddings.semanticInputVersion,
        generationCompatibilityIdentity: input.generationCompatibilityIdentity,
        embeddingScopeIdentity: input.embeddingScopeIdentity,
        compositeTestIdentity: input.compositeTestIdentity,
      },
      select: aiProviderRevisionSelect,
    });
    await transaction.aiProviderControl.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    return created;
  });

const testedLifecycle = (input: SetTestResultInput): AiProviderLifecycle =>
  input.currentLifecycle === AiProviderLifecycle.active
    ? AiProviderLifecycle.active
    : input.status === "passed"
      ? AiProviderLifecycle.validated
      : input.status === "failed"
        ? AiProviderLifecycle.failed
        : AiProviderLifecycle.draft;

const testEvidenceData = (
  input: SetTestResultInput,
  answerProtocol: AiProviderAnswerProtocol | null | undefined,
): Readonly<Record<string, unknown>> => ({
  embeddingDimensions: input.embeddingDimensions,
  ...(input.generationCompatibilityIdentity
    ? { generationCompatibilityIdentity: input.generationCompatibilityIdentity }
    : {}),
  ...(input.embeddingScopeIdentity
    ? { embeddingScopeIdentity: input.embeddingScopeIdentity }
    : {}),
  ...(input.compositeTestIdentity
    ? { compositeTestIdentity: input.compositeTestIdentity }
    : {}),
  ...(answerProtocol === undefined ? {} : { answerProtocol }),
});

export const setTestResultRecord = (
  prisma: PrismaService,
  input: SetTestResultInput,
) => {
  const answerProtocol = answerProtocolFrom(input.result);
  const providerEvidencePassed =
    input.embeddingDimensions !== null && answerProtocol != null;
  const preserveActiveEvidence =
    input.currentLifecycle === AiProviderLifecycle.active &&
    !providerEvidencePassed;
  return prisma.aiProviderConfiguration.update({
    where: { id: input.id },
    data: {
      lifecycle: testedLifecycle(input),
      testResult: input.result,
      testedAt: input.testedAt,
      ...(preserveActiveEvidence
        ? {}
        : testEvidenceData(input, answerProtocol)),
    },
    select: aiProviderRevisionSelect,
  });
};

export const updateProgressRecord = (
  prisma: PrismaService,
  id: string,
  progress: AiProviderPreparationUpdate,
) =>
  prisma.aiProviderConfiguration.update({
    where: { id },
    data: {
      preparationCompleted: progress.completed,
      preparationTotal: progress.total,
      preparationFailed: progress.failed,
      preparationElapsedMs: progress.elapsedMs,
      preparationStartedAt: progress.startedAt,
      preparationFinishedAt: progress.finishedAt,
      ...(progress.lifecycle ? { lifecycle: progress.lifecycle } : {}),
    },
    select: aiProviderRevisionSelect,
  });
