import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from "@mistralai/mistralai/models/components";
import { z } from "zod";

import type { AiComposedPromptSet } from "../application/ai-feature-prompt-catalog.js";
import type {
  PlannerInput,
  PlannerRepairInput,
  ReportAssistantPlannerPort,
} from "../application/report-assistant.ports.js";
import {
  ReportAssistantProviderError,
  type ReportAssistantProviderOperation,
} from "../application/report-assistant.ports.js";
import {
  buildPlannerPrompt,
  buildPlannerRepairPrompt,
  type PlannerPrompt,
  SEARCH_REPORT_ENTRIES_TOOL_NAME,
} from "../application/report-assistant.prompts.js";

const MISTRAL_SERVERS = ["global", "eu", "us"] as const;
const RATE_LIMIT_STATUS = 429;
const SERVER_ERROR_STATUS_MIN = 500;
type MistralServer = (typeof MISTRAL_SERVERS)[number];

export type MistralPlannerAdapterConfig = Readonly<{
  apiKey: string;
  server: string;
  model: string;
  maxTokens: number;
  providerTimeoutMs: number;
  prompts: AiComposedPromptSet;
}>;

export type MistralClientConfig = Readonly<{
  apiKey: string;
  server: string;
  providerTimeoutMs: number;
}>;

export type MistralChatClient = Readonly<{
  complete(
    request: ChatCompletionRequest,
    options?: Readonly<{ timeoutMs?: number }>,
  ): Promise<ChatCompletionResponse>;
}>;

type ParsedChatRequest = Omit<ChatCompletionRequest, "responseFormat"> & {
  responseFormat: z.ZodType;
};

type ParsedChatResponse = Readonly<{
  choices?: readonly Readonly<{
    message?: Readonly<{ parsed?: unknown }>;
  }>[];
  usage?: Readonly<{
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }>;
}>;

export type MistralStructuredChatClient = Readonly<{
  parse(
    request: ParsedChatRequest,
    options?: Readonly<{ timeoutMs?: number }>,
  ): Promise<ParsedChatResponse>;
}>;

const providerStatusCode = (cause: unknown): number | undefined => {
  if (typeof cause !== "object" || cause === null) return undefined;
  if (!("statusCode" in cause)) return undefined;
  const statusCode = cause.statusCode;
  return typeof statusCode === "number" && Number.isInteger(statusCode)
    ? statusCode
    : undefined;
};

const isRetryableStatus = (statusCode: number | undefined): boolean =>
  statusCode === undefined ||
  statusCode === RATE_LIMIT_STATUS ||
  statusCode >= SERVER_ERROR_STATUS_MIN;

export class MistralProviderError extends ReportAssistantProviderError {
  constructor(operation: ReportAssistantProviderOperation, cause: unknown) {
    const statusCode = providerStatusCode(cause);
    super(operation, cause, statusCode, isRetryableStatus(statusCode));
    this.name = "MistralProviderError";
  }
}

export class MistralProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MistralProtocolError";
  }
}

const requiredText = (value: string, label: string): string => {
  if (value.trim().length === 0) throw new Error(`${label} must be non-empty`);
  return value;
};

const serverFromConfig = (value: string): MistralServer => {
  if ((MISTRAL_SERVERS as readonly string[]).includes(value)) {
    return value as MistralServer;
  }
  throw new Error("MISTRAL_API_SERVER must be global, eu, or us");
};

export const validateMistralClientConfig = (
  config: MistralClientConfig,
): void => {
  requiredText(config.apiKey, "MISTRAL_API_KEY");
  serverFromConfig(config.server);
  if (
    !Number.isInteger(config.providerTimeoutMs) ||
    config.providerTimeoutMs < 1
  ) {
    throw new Error("REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS must be positive");
  }
};

const validateConfig = (config: MistralPlannerAdapterConfig): void => {
  validateMistralClientConfig(config);
  requiredText(config.model, "MISTRAL_PLANNER_MODEL");
  if (!Number.isInteger(config.maxTokens) || config.maxTokens < 1) {
    throw new Error("MISTRAL_PLANNER_MAX_TOKENS must be positive");
  }
};

const toolCallArguments = (response: ChatCompletionResponse): unknown => {
  const calls = response.choices.flatMap(
    (choice) => choice.message?.toolCalls ?? [],
  );
  if (calls.length !== 1) {
    throw new MistralProtocolError(
      "Mistral planner must return exactly one tool call",
    );
  }
  const call = calls[0];
  if (call?.function.name !== SEARCH_REPORT_ENTRIES_TOOL_NAME) {
    throw new MistralProtocolError(
      "Mistral planner returned an unexpected tool",
    );
  }
  if (typeof call.function.arguments !== "string")
    return call.function.arguments;
  try {
    return JSON.parse(call.function.arguments) as unknown;
  } catch {
    throw new MistralProtocolError(
      "Mistral planner returned invalid tool JSON",
    );
  }
};

const request = async (
  client: MistralChatClient,
  prompt: PlannerPrompt,
  config: MistralPlannerAdapterConfig,
  operation: "planner" | "planner repair",
): Promise<unknown> => {
  const tools: ChatCompletionRequest["tools"] = [prompt.tool];
  const complete = async (): Promise<ChatCompletionResponse> =>
    client.complete(
      {
        model: config.model,
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.data },
        ],
        tools,
        toolChoice: prompt.toolChoice,
        parallelToolCalls: prompt.parallelToolCalls,
      },
      { timeoutMs: config.providerTimeoutMs },
    );
  const response = await (async () => {
    try {
      return await complete();
    } catch (error) {
      throw new MistralProviderError(operation, error);
    }
  })();
  return toolCallArguments(response);
};

export class MistralPlannerAdapter implements ReportAssistantPlannerPort {
  constructor(
    private readonly client: MistralChatClient,
    private readonly config: MistralPlannerAdapterConfig,
  ) {
    validateConfig(config);
  }

  plan(input: PlannerInput): Promise<unknown> {
    return request(
      this.client,
      buildPlannerPrompt(input, this.config.prompts),
      this.config,
      "planner",
    );
  }

  repairPlan(input: PlannerRepairInput): Promise<unknown> {
    return request(
      this.client,
      buildPlannerRepairPrompt(input, this.config.prompts),
      this.config,
      "planner repair",
    );
  }
}
