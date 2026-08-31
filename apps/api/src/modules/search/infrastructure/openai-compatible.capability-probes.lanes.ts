import { searchPlanSchema } from "@customreport/shared";

import { baselineReportAssistantPrompts } from "../../ai-prompts/index.js";
import type {
  AiProviderCapabilityRuntimeConfig,
  ResolvedCompositeProviderProfile,
} from "../../ai-provider/index.js";
import type { PlannerInput } from "../application/report-assistant.ports.js";
import { OpenAiCompatiblePlannerAdapter } from "./openai-compatible.adapters.js";
import { runAnswer } from "./openai-compatible.answer-probe.js";
import {
  type CapabilityProbeResult,
  embeddingContract,
  type EmbeddingLaneResult,
  failureResult,
  failureStatus,
  type GenerationLaneResult,
  isAuthenticationFailure,
  isConnectionFailure,
  statusOf,
} from "./openai-compatible.capability-probes.support.js";
import type { OpenAiCompatibleTransport } from "./openai-compatible.transport.js";
import { OpenAiCompatibleProtocolError } from "./openai-compatible.transport.js";

const operationInput: PlannerInput = {
  question: "Synthetic capability probe. Return the empty safe search plan.",
  now: new Date("2026-01-01T00:00:00.000Z"),
  timeZone: "UTC",
};

export const generationLane = async (
  transport: OpenAiCompatibleTransport,
  profile: ResolvedCompositeProviderProfile["generation"],
  plannerMaxTokens: number,
  answerMaxTokens: number,
  runtime: AiProviderCapabilityRuntimeConfig | undefined,
): Promise<GenerationLaneResult> => {
  const prompts = baselineReportAssistantPrompts();
  const planner = new OpenAiCompatiblePlannerAdapter(transport, {
    model: profile.plannerModel,
    maxTokens: plannerMaxTokens,
    ...(runtime
      ? {
          reasoning: {
            profile: profile.profile,
            mode: runtime.reasoningMode,
            customValue: runtime.reasoningCustomValue,
          },
        }
      : {}),
    prompts,
  });
  try {
    const rawPlan = await planner.plan(operationInput);
    const parsedPlan = searchPlanSchema.safeParse(rawPlan);
    if (!parsedPlan.success) {
      throw new OpenAiCompatibleProtocolError(
        "Planner returned incompatible tool arguments",
      );
    }
  } catch (error) {
    const connectionFailure = isConnectionFailure(error);
    const authenticationFailure = isAuthenticationFailure(error);
    return {
      status: failureStatus(error),
      capabilities: [
        failureResult(
          authenticationFailure ? "authentication" : "structured_planner",
          error,
        ),
      ],
      connectionFailed: connectionFailure,
    };
  }
  const authentication: CapabilityProbeResult = {
    capability: "authentication",
    status: "passed",
  };
  const structuredPlanner: CapabilityProbeResult = {
    capability: "structured_planner",
    status: "passed",
  };
  try {
    const answer = await runAnswer(
      transport,
      {
        ...profile,
        embeddingModel: "synthetic",
        embeddingDimensions: null,
        semanticInputVersion: "synthetic",
      },
      answerMaxTokens,
      runtime,
      prompts,
    );
    const capabilities: CapabilityProbeResult[] = [
      authentication,
      structuredPlanner,
      answer.result,
      {
        capability: "token_usage",
        status: answer.result.status,
        ...(answer.result.failureCode
          ? { failureCode: answer.result.failureCode }
          : {}),
      },
    ];
    return {
      status: statusOf(capabilities),
      capabilities,
      connectionFailed: false,
    };
  } catch (error) {
    return {
      status: failureStatus(error),
      capabilities: [
        authentication,
        structuredPlanner,
        failureResult("structured_answer", error),
      ],
      connectionFailed: isConnectionFailure(error),
    };
  }
};

export const embeddingLane = async (
  transport: OpenAiCompatibleTransport,
  profile: ResolvedCompositeProviderProfile["embeddings"]["effective"],
): Promise<EmbeddingLaneResult> => {
  try {
    const result = await embeddingContract(transport, profile.model);
    const capabilities: CapabilityProbeResult[] = [
      { capability: "authentication", status: "passed" },
      { capability: "batch_embeddings", status: "passed" },
      { capability: "token_usage", status: "passed" },
    ];
    return {
      status: "passed",
      capabilities,
      dimensions: result.dimensions,
      connectionFailed: false,
    };
  } catch (error) {
    const connectionFailure = isConnectionFailure(error);
    const capability = connectionFailure
      ? ("authentication" as const)
      : error instanceof OpenAiCompatibleProtocolError &&
          error.message.includes("usage")
        ? ("token_usage" as const)
        : ("batch_embeddings" as const);
    return {
      status: failureStatus(error),
      capabilities: [failureResult(capability, error)],
      dimensions: null,
      connectionFailed: connectionFailure,
    };
  }
};
