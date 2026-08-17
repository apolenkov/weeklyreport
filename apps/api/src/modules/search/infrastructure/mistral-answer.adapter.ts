import type { AiComposedPromptSet } from "../application/ai-feature-prompt-catalog.js";
import type {
  CitationRepairInput,
  GroundedAnswer,
  GroundedAnswerInput,
  ReportAssistantAnswerPort,
} from "../application/report-assistant.ports.js";
import {
  buildCitationRepairPrompt,
  buildGroundedAnswerPrompt,
  type GroundedAnswerPrompt,
  groundedAnswerResponseSchema,
} from "../application/report-assistant.prompts.js";
import {
  type MistralClientConfig,
  MistralProtocolError,
  MistralProviderError,
  type MistralStructuredChatClient,
  validateMistralClientConfig,
} from "./mistral-planner.adapter.js";

export type MistralAnswerAdapterConfig = MistralClientConfig &
  Readonly<{
    model: string;
    maxTokens: number;
    prompts: AiComposedPromptSet;
  }>;

const validateConfig = (config: MistralAnswerAdapterConfig): void => {
  validateMistralClientConfig(config);
  if (config.model.trim().length === 0) {
    throw new Error("MISTRAL_ANSWER_MODEL must be non-empty");
  }
  if (!Number.isInteger(config.maxTokens) || config.maxTokens < 1) {
    throw new Error("MISTRAL_ANSWER_MAX_TOKENS must be positive");
  }
};

const usageNumber = (value: number | undefined, label: string): number => {
  if (value === undefined || !Number.isInteger(value) || value < 0) {
    throw new MistralProtocolError(`Mistral response omitted ${label}`);
  }
  return value;
};

const parseAnswer = (
  response: Awaited<ReturnType<MistralStructuredChatClient["parse"]>>,
): GroundedAnswer => {
  if (response.choices?.length !== 1) {
    throw new MistralProtocolError(
      "Mistral answer must return exactly one structured choice",
    );
  }
  const parsed = groundedAnswerResponseSchema.safeParse(
    response.choices[0]?.message?.parsed,
  );
  if (!parsed.success) {
    throw new MistralProtocolError("Mistral answer failed structured parsing");
  }
  const usage = response.usage;
  return {
    answerMarkdown: parsed.data.answerMarkdown,
    sourceIds: parsed.data.citedSourceIds,
    insufficientEvidence: parsed.data.insufficientEvidence,
    usage: {
      promptTokens: usageNumber(usage?.promptTokens, "prompt token usage"),
      completionTokens: usageNumber(
        usage?.completionTokens,
        "completion token usage",
      ),
      totalTokens: usageNumber(usage?.totalTokens, "total token usage"),
    },
  };
};

const call = async (
  client: MistralStructuredChatClient,
  prompt: GroundedAnswerPrompt,
  config: MistralAnswerAdapterConfig,
  operation: "answer" | "citation repair",
) => {
  try {
    return await client.parse(
      {
        model: config.model,
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.data },
        ],
        responseFormat: groundedAnswerResponseSchema,
      },
      { timeoutMs: config.providerTimeoutMs },
    );
  } catch (error) {
    throw new MistralProviderError(operation, error);
  }
};

export class MistralAnswerAdapter implements ReportAssistantAnswerPort {
  constructor(
    private readonly client: MistralStructuredChatClient,
    private readonly config: MistralAnswerAdapterConfig,
  ) {
    validateConfig(config);
  }

  async answer(input: GroundedAnswerInput): Promise<GroundedAnswer> {
    return parseAnswer(
      await call(
        this.client,
        buildGroundedAnswerPrompt(input, this.config.prompts),
        this.config,
        "answer",
      ),
    );
  }

  async repairAnswer(input: CitationRepairInput): Promise<GroundedAnswer> {
    return parseAnswer(
      await call(
        this.client,
        buildCitationRepairPrompt(input, this.config.prompts),
        this.config,
        "citation repair",
      ),
    );
  }
}
