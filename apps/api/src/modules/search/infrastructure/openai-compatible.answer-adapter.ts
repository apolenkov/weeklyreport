import type { AiComposedPromptSet } from "../../ai-prompts/index.js";
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
  reasoning?: OpenAiCompatibleReasoningConfig;
  prompts: AiComposedPromptSet;
}>;

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
  {
    operation,
    signal,
  }: Readonly<{
    operation: "answer" | "citation repair";
    signal?: AbortSignal | undefined;
  }>,
): Promise<GroundedAnswer> => {
  return transport
    .chat(
      {
        model: config.model,
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.data },
        ],
        responseFormat: { type: "json_object" },
        ...reasoningRequestOptions(config.reasoning),
      },
      operation,
      signal,
    )
    .then(parseStructuredAnswer);
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

  answer(
    input: GroundedAnswerInput,
    signal?: AbortSignal,
  ): Promise<GroundedAnswer> {
    return answerRequest(
      this.transport,
      buildGroundedAnswerPrompt(input, this.config.prompts),
      this.config,
      { operation: "answer", signal },
    );
  }

  repairAnswer(
    input: CitationRepairInput,
    signal?: AbortSignal,
  ): Promise<GroundedAnswer> {
    return answerRequest(
      this.transport,
      buildCitationRepairPrompt(input, this.config.prompts),
      this.config,
      { operation: "citation repair", signal },
    );
  }
}
