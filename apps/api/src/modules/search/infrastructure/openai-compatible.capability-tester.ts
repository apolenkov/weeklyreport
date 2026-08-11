import type { Prisma } from "@prisma/client";

import type {
  AiProviderCapabilityTester,
  ResolvedProviderProfile,
} from "../../ai-provider/index.js";
import type {
  GroundedAnswerInput,
  PlannerInput,
} from "../application/report-assistant.ports.js";
import type { GroundingBundle } from "../domain/context-builder.js";
import {
  OpenAiCompatibleAnswerAdapter,
  OpenAiCompatiblePlannerAdapter,
} from "./openai-compatible.adapters.js";
import {
  type OpenAiCompatibleFetch,
  OpenAiCompatibleTransport,
} from "./openai-compatible.transport.js";

type Capability =
  | "authentication"
  | "planner_tool_call"
  | "structured_answer"
  | "token_usage"
  | "batch_embeddings";

const MAX_FAILURE_CODE_LENGTH = 80;

const SYNTHETIC_GROUNDING: GroundingBundle = {
  aggregates: {
    totalCount: 0,
    byKind: [],
    byPeriod: [],
    byAuthor: [],
    groups: [],
    supportingStatusFacts: [],
  },
  evidence: [],
  truncated: false,
  estimatedTokens: 0,
};

const operationInput: PlannerInput = {
  question: "Synthetic capability probe. Return the empty safe search plan.",
  now: new Date("2026-01-01T00:00:00.000Z"),
  timeZone: "UTC",
};

const run = async <T>(
  capability: Capability,
  action: () => Promise<T>,
): Promise<
  Readonly<{
    capability: Capability;
    status: "passed" | "failed";
    failureCode?: string;
  }>
> => {
  try {
    await action();
    return { capability, status: "passed" };
  } catch (error) {
    const failureCode =
      error instanceof Error
        ? error.name.slice(0, MAX_FAILURE_CODE_LENGTH)
        : "capability_failed";
    return { capability, status: "failed", failureCode };
  }
};

const assertEmbeddingContract = async (
  transport: OpenAiCompatibleTransport,
  model: string,
): Promise<number> => {
  const response = await transport.embeddings(model, [
    "Synthetic document A",
    "Synthetic document B",
  ]);
  const documents = response.data ?? [];
  if (
    documents.length !== 2 ||
    new Set(documents.map(({ index }) => index)).size !== 2 ||
    documents.some(({ index }) => index !== 0 && index !== 1)
  ) {
    throw new Error("embedding_order_invalid");
  }
  const vectors = documents.map(({ embedding }) => embedding);
  const firstVector = vectors[0];
  if (!Array.isArray(firstVector)) throw new Error("embedding_vector_invalid");
  const dimensions = firstVector.length;
  if (
    !Number.isInteger(dimensions) ||
    dimensions < 1 ||
    vectors.some(
      (vector) =>
        !Array.isArray(vector) ||
        vector.length !== dimensions ||
        vector.some(
          (value) => typeof value !== "number" || !Number.isFinite(value),
        ),
    )
  ) {
    throw new Error("embedding_vector_invalid");
  }
  return dimensions;
};

const runEmbedding = async (
  transport: OpenAiCompatibleTransport,
  model: string,
): Promise<
  Readonly<{
    result: Awaited<ReturnType<typeof run>>;
    dimensions: number | null;
  }>
> => {
  try {
    const dimensions = await assertEmbeddingContract(transport, model);
    return {
      result: { capability: "batch_embeddings", status: "passed" },
      dimensions,
    };
  } catch (error) {
    return {
      result: await run("batch_embeddings", () => {
        throw error;
      }),
      dimensions: null,
    };
  }
};

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
    profile: ResolvedProviderProfile,
    credential: string,
  ): Promise<
    Readonly<{ result: Prisma.JsonValue; embeddingDimensions: number | null }>
  > {
    if (this.embeddingBatchSize < 2 || this.embeddingTokenBudget < 1) {
      throw new Error("Embedding capability probe requires a batch budget");
    }
    const transport = new OpenAiCompatibleTransport({
      baseUrl: profile.baseUrl,
      credential,
      timeoutMs: this.timeoutMs,
      fetcher: this.fetcher,
    });
    const planner = new OpenAiCompatiblePlannerAdapter(transport, {
      model: profile.plannerModel,
      maxTokens: this.plannerMaxTokens,
    });
    const answerer = new OpenAiCompatibleAnswerAdapter(transport, {
      model: profile.answerModel,
      maxTokens: this.answerMaxTokens,
    });
    const plannerResult = await run("planner_tool_call", () =>
      planner.plan(operationInput),
    );
    const answerResult = await run("structured_answer", async () => {
      const input: GroundedAnswerInput = {
        question: "Synthetic answer capability probe.",
        grounding: SYNTHETIC_GROUNDING,
      };
      const answer = await answerer.answer(input);
      if (answer.usage.totalTokens < 0) throw new Error("usage_invalid");
    });
    const embedding = await runEmbedding(transport, profile.embeddingModel);
    const capabilities = [
      {
        capability: "authentication" as const,
        status: plannerResult.status,
        ...(plannerResult.failureCode
          ? { failureCode: plannerResult.failureCode }
          : {}),
      },
      plannerResult,
      {
        capability: "token_usage" as const,
        status: answerResult.status,
        ...(answerResult.failureCode
          ? { failureCode: answerResult.failureCode }
          : {}),
      },
      answerResult,
      embedding.result,
    ];
    const failed = capabilities.filter(({ status }) => status === "failed");
    return {
      result: {
        status: failed.length === 0 ? "passed" : "failed",
        capabilities,
        testedAt: new Date().toISOString(),
      },
      embeddingDimensions: embedding.dimensions,
    };
  }
}
