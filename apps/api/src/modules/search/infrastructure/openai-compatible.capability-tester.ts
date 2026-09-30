import type { Prisma } from "@prisma/client";

import type {
  AiProviderCapabilityRuntimeConfig,
  AiProviderCapabilityTester,
  ResolvedCompositeProviderProfile,
} from "../../ai-provider/index.js";
import { runCompositeCapabilityProbes } from "./openai-compatible.capability-probes.js";
import {
  type OpenAiCompatibleFetch,
  OpenAiCompatibleTransport,
} from "./openai-compatible.transport.js";

export class OpenAiCompatibleCapabilityTester implements AiProviderCapabilityTester {
  constructor(
    private readonly config: Readonly<{
      timeoutMs: number;
      plannerMaxTokens: number;
      answerMaxTokens: number;
      embeddingBatchSize: number;
      embeddingTokenBudget: number;
    }>,
    private readonly fetcher?: OpenAiCompatibleFetch,
  ) {}

  async test(
    profile: ResolvedCompositeProviderProfile,
    credentials: Readonly<{ generation: string; embeddings: string }>,
    runtime?: AiProviderCapabilityRuntimeConfig,
  ): Promise<
    Readonly<{
      result: Prisma.JsonValue;
      embeddingDimensions: number | null;
    }>
  > {
    if (
      this.config.embeddingBatchSize < 2 ||
      this.config.embeddingTokenBudget < 1
    ) {
      throw new Error("Embedding capability probe requires a batch budget");
    }
    const generationTransport = new OpenAiCompatibleTransport({
      baseUrl: profile.generation.baseUrl,
      credential: credentials.generation,
      timeoutMs: this.config.timeoutMs,
      ...(this.fetcher ? { fetcher: this.fetcher } : {}),
    });
    const embeddingsTransport =
      profile.embeddings.mode === "reuse_generation"
        ? generationTransport
        : new OpenAiCompatibleTransport({
            baseUrl: profile.embeddings.connection.baseUrl,
            credential: credentials.embeddings,
            timeoutMs: this.config.timeoutMs,
            ...(this.fetcher ? { fetcher: this.fetcher } : {}),
          });
    const probe = await runCompositeCapabilityProbes({
      transports: {
        generation: generationTransport,
        embeddings: embeddingsTransport,
      },
      profile,
      plannerMaxTokens: this.config.plannerMaxTokens,
      answerMaxTokens: this.config.answerMaxTokens,
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
