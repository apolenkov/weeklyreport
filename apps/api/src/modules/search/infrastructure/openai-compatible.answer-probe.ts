import type { AiProviderAnswerProtocol } from "@customreport/shared";

import type {
  AiProviderCapabilityRuntimeConfig,
  ResolvedProviderProfile,
} from "../../ai-provider/index.js";
import type { AiComposedPromptSet } from "../application/ai-feature-prompt-catalog.js";
import type { GroundedAnswerInput } from "../application/report-assistant.ports.js";
import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";
import type { GroundingBundle } from "../domain/context-builder.js";
import { OpenAiCompatibleAnswerAdapter } from "./openai-compatible.answer-adapter.js";
import { type OpenAiCompatibleTransport } from "./openai-compatible.transport.js";

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

export const safeFailureCode = (error: unknown): string => {
  const source =
    error instanceof ReportAssistantProviderError
      ? error.providerCode
      : error instanceof Error
        ? error.name
        : null;
  const normalized = (source ?? "capability_failed").replaceAll(
    /[^a-zA-Z0-9_.-]/gu,
    "_",
  );
  return (normalized || "capability_failed").slice(0, MAX_FAILURE_CODE_LENGTH);
};

export type AnswerProbe = Readonly<{
  result: Readonly<{
    capability: "structured_answer";
    status: "passed" | "failed";
    failureCode?: string;
  }>;
  answerProtocol: AiProviderAnswerProtocol | null;
}>;

export const runAnswer = async (
  transport: OpenAiCompatibleTransport,
  profile: ResolvedProviderProfile,
  answerMaxTokens: number,
  runtime: AiProviderCapabilityRuntimeConfig | undefined,
  prompts: AiComposedPromptSet,
): Promise<AnswerProbe> => {
  const input: GroundedAnswerInput = {
    question: "Synthetic answer capability probe.",
    grounding: SYNTHETIC_GROUNDING,
  };
  const reasoning = runtime
    ? {
        profile: profile.profile,
        mode: runtime.reasoningMode,
        customValue: runtime.reasoningCustomValue,
      }
    : undefined;
  const probe = async (answerProtocol: AiProviderAnswerProtocol) => {
    const answerer = new OpenAiCompatibleAnswerAdapter(transport, {
      model: profile.answerModel,
      maxTokens: answerMaxTokens,
      answerProtocol,
      prompts,
      ...(reasoning ? { reasoning } : {}),
    });
    const answer = await answerer.answer(input);
    if (answer.usage.totalTokens < 0) throw new Error("usage_invalid");
  };

  try {
    await probe("json_object");
    return {
      result: { capability: "structured_answer", status: "passed" },
      answerProtocol: "json_object",
    };
  } catch (error) {
    if (error instanceof ReportAssistantProviderError) throw error;
    return {
      result: {
        capability: "structured_answer",
        status: "failed",
        failureCode: safeFailureCode(error),
      },
      answerProtocol: null,
    };
  }
};
