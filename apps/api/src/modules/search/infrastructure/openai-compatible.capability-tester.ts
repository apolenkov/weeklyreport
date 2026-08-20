import type { Prisma } from "@prisma/client";

import type {
  AiProviderCapabilityRuntimeConfig,
  AiProviderCapabilityTester,
  ResolvedCompositeProviderProfile,
  ResolvedProviderProfile,
} from "../../ai-provider/index.js";
import { runCompositeCapabilityProbes } from "./openai-compatible.capability-probes.js";
import {
  type OpenAiCompatibleFetch,
  OpenAiCompatibleTransport,
} from "./openai-compatible.transport.js";

export class OpenAiCompatibleCapabilityTester implements AiProviderCapabilityTester {
  constructor(
    private readonly timeoutMs: number,
    private readonly plannerMaxTokens: number,
    private readonly answerMaxTokens: number,
    private readonly embeddingBatchSize: number,
    private readonly embeddingTokenBudget: number,
    private readonly fetcher?: OpenAiCompatibleFetch,
  ) {}

  async test(
    profile: ResolvedCompositeProviderProfile | ResolvedProviderProfile,
    credentials: Readonly<{ generation: string; embeddings: string }> | string,
    runtime?: AiProviderCapabilityRuntimeConfig,
  ): Promise<
    Readonly<{
      result: Prisma.JsonValue;
      embeddingDimensions: number | null;
    }>
  > {
    if (this.embeddingBatchSize < 2 || this.embeddingTokenBudget < 1) {
      throw new Error("Embedding capability probe requires a batch budget");
    }
    const composite =
      "generation" in profile ? profile : legacyComposite(profile);
    const generationTransport = new OpenAiCompatibleTransport({
      baseUrl: composite.generation.baseUrl,
      credential:
        typeof credentials === "string" ? credentials : credentials.generation,
      timeoutMs: this.timeoutMs,
      fetcher: this.fetcher,
    });
    const embeddingsTransport =
      composite.embeddings.mode === "reuse_generation"
        ? generationTransport
        : new OpenAiCompatibleTransport({
            baseUrl: composite.embeddings.connection.baseUrl,
            credential:
              typeof credentials === "string"
                ? credentials
                : credentials.embeddings,
            timeoutMs: this.timeoutMs,
            fetcher: this.fetcher,
          });
    const probe = await runCompositeCapabilityProbes({
      transports: {
        generation: generationTransport,
        embeddings: embeddingsTransport,
      },
      profile: composite,
      plannerMaxTokens: this.plannerMaxTokens,
      answerMaxTokens: this.answerMaxTokens,
      ...(runtime ? { runtime } : {}),
    });
    return {
      result: {
        status: probe.status,
        generation: {
          ...probe.generation,
          capabilities: [...probe.generation.capabilities],
        },
        embeddings: {
          ...probe.embeddings,
          capabilities: [...probe.embeddings.capabilities],
        },
        testedAt: new Date().toISOString(),
      } as Prisma.JsonValue,
      embeddingDimensions: probe.embeddingDimensions,
    };
  }
}

const legacyComposite = (
  profile: ResolvedProviderProfile,
): ResolvedCompositeProviderProfile => ({
  generation: {
    profile: profile.profile,
    baseUrl: profile.baseUrl,
    endpointIdentity: profile.endpointIdentity,
    plannerModel: profile.plannerModel,
    answerModel: profile.answerModel,
    reasoningMode: profile.reasoningMode,
    reasoningCustomValue: profile.reasoningCustomValue,
  },
  embeddings: {
    mode: "reuse_generation",
    effective: {
      profile: profile.profile,
      baseUrl: profile.baseUrl,
      endpointIdentity: profile.endpointIdentity,
      model: profile.embeddingModel,
      dimensions: profile.embeddingDimensions,
      semanticInputVersion: profile.semanticInputVersion,
    },
  },
});
