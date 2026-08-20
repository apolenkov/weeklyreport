import type { Prisma } from "@prisma/client";

export const aiProviderRevisionSelect = {
  id: true,
  generationProfile: true,
  generationBaseUrl: true,
  generationEndpointIdentity: true,
  plannerModel: true,
  answerModel: true,
  embeddingModel: true,
  embeddingDimensions: true,
  semanticInputVersion: true,
  reasoningMode: true,
  reasoningCustomValue: true,
  generationCredentialCiphertext: true,
  generationCredentialNonce: true,
  generationCredentialTag: true,
  generationCredentialKeyVersion: true,
  generationCredentialMaskedSuffix: true,
  embeddingMode: true,
  embeddingProfile: true,
  embeddingBaseUrl: true,
  embeddingEndpointIdentity: true,
  embeddingCredentialCiphertext: true,
  embeddingCredentialNonce: true,
  embeddingCredentialTag: true,
  embeddingCredentialKeyVersion: true,
  embeddingCredentialMaskedSuffix: true,
  generationCompatibilityIdentity: true,
  embeddingScopeIdentity: true,
  compositeTestIdentity: true,
  lifecycle: true,
  testResult: true,
  testExecutions: {
    select: {
      id: true,
      state: true,
      outcome: true,
      failureCode: true,
      checks: true,
      requestedAt: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: { requestedAt: "desc" as const },
    take: 1,
  },
  testedAt: true,
  preparationCompleted: true,
  preparationTotal: true,
  preparationFailed: true,
  preparationStartedAt: true,
  preparationFinishedAt: true,
  preparationElapsedMs: true,
  activatedAt: true,
  supersededAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const aiProviderControlInclude = {
  activeConfiguration: { select: aiProviderRevisionSelect },
} as const;

export type AiProviderRevisionRecord =
  Prisma.AiProviderConfigurationGetPayload<{
    select: typeof aiProviderRevisionSelect;
  }>;

export type AiProviderControlRecord = Prisma.AiProviderControlGetPayload<{
  include: typeof aiProviderControlInclude;
}>;
