import type { Prisma } from "@prisma/client";

export const aiProviderRevisionSelect = {
  id: true,
  profile: true,
  baseUrl: true,
  endpointIdentity: true,
  plannerModel: true,
  answerModel: true,
  embeddingModel: true,
  embeddingDimensions: true,
  semanticInputVersion: true,
  credentialCiphertext: true,
  credentialNonce: true,
  credentialTag: true,
  credentialKeyVersion: true,
  credentialMaskedSuffix: true,
  lifecycle: true,
  testResult: true,
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
