import { z } from "zod";

import type {
  CitationRepairInput,
  GroundedAnswer,
  GroundedAnswerInput,
  PlannerInput,
  PlannerRepairInput,
  ReportAssistantAnswerPort,
  ReportAssistantCitationRepairPort,
  ReportAssistantPlannerPort,
  ReportAssistantPlannerRepairPort,
} from "../application/report-assistant.ports.js";
import {
  buildCitationRepairPrompt,
  buildGroundedAnswerPrompt,
  buildPlannerPrompt,
  buildPlannerRepairPrompt,
  groundedAnswerResponseSchema,
  SEARCH_REPORT_ENTRIES_TOOL_NAME,
} from "../application/report-assistant.prompts.js";
import {
  type OpenAiCompatibleChatResponse,
  OpenAiCompatibleProtocolError,
  OpenAiCompatibleTransport,
} from "./openai-compatible.transport.js";

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

export type OpenAiCompatiblePlannerConfig = Readonly<{
  model: string;
  maxTokens: number;
}>;

const plannerRequest = (
  transport: OpenAiCompatibleTransport,
  prompt: ReturnType<typeof buildPlannerPrompt>,
  config: OpenAiCompatiblePlannerConfig,
  operation: "planner" | "planner repair",
): Promise<unknown> =>
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
      },
      operation,
    )
    .then(parseToolArguments);

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

  plan(input: PlannerInput): Promise<unknown> {
    return plannerRequest(
      this.transport,
      buildPlannerPrompt(input),
      this.config,
      "planner",
    );
  }

  repairPlan(input: PlannerRepairInput): Promise<unknown> {
    return plannerRequest(
      this.transport,
      buildPlannerRepairPrompt(input),
      this.config,
      "planner repair",
    );
  }
}

export type OpenAiCompatibleAnswerConfig = Readonly<{
  model: string;
  maxTokens: number;
}>;

const groundedAnswerJsonSchema = (): Record<string, unknown> => {
  const schema = z.toJSONSchema(groundedAnswerResponseSchema) as Record<
    string,
    unknown
  >;
  const { $schema: _schema, ...withoutMeta } = schema;
  return withoutMeta;
};

const parseStructuredAnswer = (
  response: OpenAiCompatibleChatResponse,
): GroundedAnswer => {
  if (response.choices?.length !== 1) {
    throw new OpenAiCompatibleProtocolError(
      "Answer must return exactly one structured choice",
    );
  }
  const content = response.choices[0]?.message?.content;
  const parsedContent =
    typeof content === "string"
      ? (() => {
          try {
            return JSON.parse(content) as unknown;
          } catch {
            return undefined;
          }
        })()
      : content;
  const parsed = groundedAnswerResponseSchema.safeParse(parsedContent);
  if (!parsed.success) {
    throw new OpenAiCompatibleProtocolError("Answer failed structured parsing");
  }
  return {
    answerMarkdown: parsed.data.answerMarkdown,
    sourceIds: parsed.data.citedSourceIds,
    insufficientEvidence: parsed.data.insufficientEvidence,
    usage: OpenAiCompatibleTransport.usage(response.usage),
  };
};

const answerRequest = (
  transport: OpenAiCompatibleTransport,
  prompt: ReturnType<typeof buildGroundedAnswerPrompt>,
  config: OpenAiCompatibleAnswerConfig,
  operation: "answer" | "citation repair",
): Promise<GroundedAnswer> =>
  transport
    .chat(
      {
        model: config.model,
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.data },
        ],
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "grounded_report_answer",
            strict: true,
            schema: groundedAnswerJsonSchema(),
          },
        },
      },
      operation,
    )
    .then(parseStructuredAnswer);

export class OpenAiCompatibleAnswerAdapter
  implements ReportAssistantAnswerPort, ReportAssistantCitationRepairPort
{
  constructor(
    private readonly transport: OpenAiCompatibleTransport,
    private readonly config: OpenAiCompatibleAnswerConfig,
  ) {
    if (config.model.trim().length === 0)
      throw new Error("Answer model is required");
    if (!Number.isInteger(config.maxTokens) || config.maxTokens < 1) {
      throw new Error("Answer token limit must be positive");
    }
  }

  answer(input: GroundedAnswerInput): Promise<GroundedAnswer> {
    return answerRequest(
      this.transport,
      buildGroundedAnswerPrompt(input),
      this.config,
      "answer",
    );
  }

  repairAnswer(input: CitationRepairInput): Promise<GroundedAnswer> {
    return answerRequest(
      this.transport,
      buildCitationRepairPrompt(input),
      this.config,
      "citation repair",
    );
  }
}

export { OpenAiCompatibleEmbeddingAdapter } from "./openai-compatible.embedding-adapter.js";
