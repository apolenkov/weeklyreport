import type { AiComposedPromptSet } from "../../ai-prompts/index.js";
import type {
  PlannerInput,
  PlannerRepairInput,
  ReportAssistantPlannerPort,
  ReportAssistantPlannerRepairPort,
} from "../application/report-assistant.ports.js";
import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";
import {
  buildPlannerPrompt,
  buildPlannerRepairPrompt,
  SEARCH_REPORT_ENTRIES_TOOL_NAME,
} from "../application/report-assistant.prompts.js";
import {
  type OpenAiCompatibleReasoningConfig,
  reasoningRequestOptions,
} from "./openai-compatible.reasoning.js";
import {
  type OpenAiCompatibleChatResponse,
  OpenAiCompatibleProtocolError,
  OpenAiCompatibleTransport,
} from "./openai-compatible.transport.js";

export { reasoningRequestOptions } from "./openai-compatible.reasoning.js";

const parseToolArguments = (
  response: OpenAiCompatibleChatResponse,
): unknown => {
  const calls = (response.choices ?? []).flatMap((choice) =>
    choice.message?.tool_calls ? [...choice.message.tool_calls] : [],
  );
  if (calls.length !== 1) {
    throw new OpenAiCompatibleProtocolError(
      "Planner must return exactly one tool call",
    );
  }
  const call = calls[0]?.function;
  if (call?.name !== SEARCH_REPORT_ENTRIES_TOOL_NAME) {
    throw new OpenAiCompatibleProtocolError(
      "Planner returned an unexpected tool",
    );
  }
  if (typeof call.arguments !== "string") return call.arguments;
  try {
    return JSON.parse(call.arguments) as unknown;
  } catch {
    throw new OpenAiCompatibleProtocolError(
      "Planner returned invalid tool JSON",
    );
  }
};

const TOOL_USE_FAILED = "tool_use_failed";
const DETERMINISTIC_TOOL_TEMPERATURE = 0.2;
const HTTP_BAD_REQUEST = 400;

const retryableToolGeneration = (error: unknown): boolean =>
  error instanceof ReportAssistantProviderError &&
  error.statusCode === HTTP_BAD_REQUEST &&
  error.providerCode?.toLowerCase() === TOOL_USE_FAILED;

export type OpenAiCompatiblePlannerConfig = Readonly<{
  model: string;
  maxTokens: number;
  reasoning?: OpenAiCompatibleReasoningConfig;
  prompts: AiComposedPromptSet;
}>;

const plannerRequest = (
  transport: OpenAiCompatibleTransport,
  prompt: ReturnType<typeof buildPlannerPrompt>,
  config: OpenAiCompatiblePlannerConfig,
  {
    operation,
    signal,
  }: Readonly<{
    operation: "planner" | "planner repair";
    signal?: AbortSignal | undefined;
  }>,
): Promise<unknown> => {
  const toolRequest = (temperature?: number) =>
    transport
      .chat(
        {
          model: config.model,
          maxTokens: config.maxTokens,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.data },
          ],
          tools: [prompt.tool],
          toolChoice: prompt.toolChoice,
          parallelToolCalls: prompt.parallelToolCalls,
          ...reasoningRequestOptions(config.reasoning),
          ...(temperature === undefined ? {} : { temperature }),
        },
        operation,
        signal,
      )
      .then(parseToolArguments);
  return toolRequest().catch((error: unknown) => {
    if (!retryableToolGeneration(error)) throw error;
    return toolRequest(DETERMINISTIC_TOOL_TEMPERATURE);
  });
};

export class OpenAiCompatiblePlannerAdapter
  implements ReportAssistantPlannerPort, ReportAssistantPlannerRepairPort
{
  constructor(
    private readonly transport: OpenAiCompatibleTransport,
    private readonly config: OpenAiCompatiblePlannerConfig,
  ) {
    if (config.model.trim().length === 0)
      throw new Error("Planner model is required");
    if (!Number.isInteger(config.maxTokens) || config.maxTokens < 1) {
      throw new Error("Planner token limit must be positive");
    }
  }

  plan(input: PlannerInput, signal?: AbortSignal): Promise<unknown> {
    return plannerRequest(
      this.transport,
      buildPlannerPrompt(input, this.config.prompts),
      this.config,
      { operation: "planner", signal },
    );
  }

  repairPlan(
    input: PlannerRepairInput,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return plannerRequest(
      this.transport,
      buildPlannerRepairPrompt(input, this.config.prompts),
      this.config,
      { operation: "planner repair", signal },
    );
  }
}

export { OpenAiCompatibleEmbeddingAdapter } from "./openai-compatible.embedding-adapter.js";
