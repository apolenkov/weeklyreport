import type { AiProviderAnswerProtocol } from "@customreport/shared";
import { z } from "zod";

import type { AiComposedPromptSet } from "../application/ai-feature-prompt-catalog.js";
import type {
  CitationRepairInput,
  GroundedAnswer,
  GroundedAnswerInput,
  ReportAssistantAnswerPort,
  ReportAssistantCitationRepairPort,
} from "../application/report-assistant.ports.js";
import {
  buildCitationRepairPrompt,
  buildGroundedAnswerPrompt,
  groundedAnswerResponseSchema,
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

export type OpenAiCompatibleAnswerConfig = Readonly<{
  model: string;
  maxTokens: number;
  answerProtocol: AiProviderAnswerProtocol;
  reasoning?: OpenAiCompatibleReasoningConfig;
  prompts: AiComposedPromptSet;
}>;

const groundedAnswerJsonSchema = (): Record<string, unknown> => {
  const schema = z.toJSONSchema(groundedAnswerResponseSchema) as Record<
    string,
    unknown
  >;
  const { $schema: _schema, ...withoutMeta } = schema;
  return withoutMeta;
};

const SUBMIT_GROUNDED_REPORT_ANSWER_TOOL_NAME =
  "submit_grounded_report_answer" as const;

const groundedAnswerTool = (): Record<string, unknown> => ({
  type: "function",
  function: {
    name: SUBMIT_GROUNDED_REPORT_ANSWER_TOOL_NAME,
    description: "Submit the grounded report answer.",
    strict: true,
    parameters: groundedAnswerJsonSchema(),
  },
});

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

const parseForcedToolAnswer = (
  response: OpenAiCompatibleChatResponse,
): GroundedAnswer => {
  const calls = (response.choices ?? []).flatMap((choice) =>
    choice.message?.tool_calls ? [...choice.message.tool_calls] : [],
  );
  const call = calls[0]?.function;
  if (
    response.choices?.length !== 1 ||
    calls.length !== 1 ||
    call?.name !== SUBMIT_GROUNDED_REPORT_ANSWER_TOOL_NAME
  ) {
    throw new OpenAiCompatibleProtocolError(
      "Answer must return exactly one named tool call",
    );
  }
  const value =
    typeof call.arguments === "string"
      ? (() => {
          try {
            return JSON.parse(call.arguments) as unknown;
          } catch {
            return undefined;
          }
        })()
      : call.arguments;
  const parsed = groundedAnswerResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new OpenAiCompatibleProtocolError(
      "Answer tool arguments are invalid",
    );
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
): Promise<GroundedAnswer> => {
  const protocolRequest =
    config.answerProtocol === "json_object"
      ? {
          responseFormat: { type: "json_object" },
        }
      : config.answerProtocol === "json_schema"
        ? {
            responseFormat: {
              type: "json_schema",
              json_schema: {
                name: "grounded_report_answer",
                strict: true,
                schema: groundedAnswerJsonSchema(),
              },
            },
          }
        : {
            tools: [groundedAnswerTool()],
            toolChoice: {
              type: "function",
              function: { name: SUBMIT_GROUNDED_REPORT_ANSWER_TOOL_NAME },
            },
            parallelToolCalls: false,
          };
  return transport
    .chat(
      {
        model: config.model,
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.data },
        ],
        ...protocolRequest,
        ...reasoningRequestOptions(config.reasoning),
      },
      operation,
    )
    .then(
      config.answerProtocol === "json_object" ||
        config.answerProtocol === "json_schema"
        ? parseStructuredAnswer
        : parseForcedToolAnswer,
    );
};

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
      buildGroundedAnswerPrompt(input, this.config.prompts),
      this.config,
      "answer",
    );
  }

  repairAnswer(input: CitationRepairInput): Promise<GroundedAnswer> {
    return answerRequest(
      this.transport,
      buildCitationRepairPrompt(input, this.config.prompts),
      this.config,
      "citation repair",
    );
  }
}
