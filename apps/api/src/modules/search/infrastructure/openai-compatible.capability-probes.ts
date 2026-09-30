import type {
  AiProviderCapabilityRuntimeConfig,
  ResolvedCompositeProviderProfile,
} from "../../ai-provider/index.js";
import {
  embeddingLane,
  generationLane,
} from "./openai-compatible.capability-probes.lanes.js";
import {
  type CapabilityProbeResult,
  type CapabilityStatus,
  statusOf,
} from "./openai-compatible.capability-probes.support.js";
import type { OpenAiCompatibleTransport } from "./openai-compatible.transport.js";

export type CompositeCapabilityProbeOutput = Readonly<{
  status: CapabilityStatus;
  generation: Readonly<{
    status: CapabilityStatus;
    capabilities: readonly CapabilityProbeResult[];
  }>;
  embeddings: Readonly<{
    status: CapabilityStatus;
    capabilities: readonly CapabilityProbeResult[];
  }>;
  embeddingDimensions: number | null;
}>;

export const runCompositeCapabilityProbes = async (input: {
  transports: Readonly<{
    generation: OpenAiCompatibleTransport;
    embeddings: OpenAiCompatibleTransport;
  }>;
  profile: ResolvedCompositeProviderProfile;
  plannerMaxTokens: number;
  answerMaxTokens: number;
  runtime?: AiProviderCapabilityRuntimeConfig;
}): Promise<CompositeCapabilityProbeOutput> => {
  const generation = await generationLane(
    input.transports.generation,
    input.profile.generation,
    input,
  );
  const reused = input.profile.embeddings.mode === "reuse_generation";
  const embeddings =
    reused && generation.connectionFailed
      ? {
          status: generation.status,
          capabilities: [] as const,
          dimensions: null,
          connectionFailed: true,
        }
      : await embeddingLane(
          input.transports.embeddings,
          input.profile.embeddings.effective,
        );
  const status = statusOf([
    ...generation.capabilities,
    ...embeddings.capabilities,
  ]);
  return {
    status,
    generation: {
      status: generation.status,
      capabilities: generation.capabilities,
    },
    embeddings: {
      status: embeddings.status,
      capabilities: embeddings.capabilities,
    },
    embeddingDimensions: embeddings.dimensions,
  };
};
