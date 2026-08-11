import type {
  ReportAssistantProviderOperation,
  ReportAssistantTokenUsage,
} from "../application/report-assistant.ports.js";
import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";

const RETRYABLE_STATUS_MIN = 500;
const RATE_LIMIT_STATUS = 429;
const MAX_PROVIDER_ERROR_CODE_LENGTH = 100;

type OpenAiCompatibleMessage = Readonly<{
  role: "system" | "user" | "assistant";
  content: string;
}>;

type OpenAiCompatibleTool = Readonly<Record<string, unknown>>;

export type OpenAiCompatibleChatRequest = Readonly<{
  model: string;
  maxTokens: number;
  messages: readonly OpenAiCompatibleMessage[];
  tools?: readonly OpenAiCompatibleTool[];
  toolChoice?: unknown;
  parallelToolCalls?: boolean;
  responseFormat?: unknown;
}>;

export type OpenAiCompatibleChatResponse = Readonly<{
  choices?: readonly Readonly<{
    message?: Readonly<{
      content?: unknown;
      tool_calls?: readonly Readonly<{
        function?: Readonly<{ name?: unknown; arguments?: unknown }>;
      }>[];
    }>;
  }>[];
  usage?: Readonly<{
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  }>;
}>;

export type OpenAiCompatibleEmbeddingResponse = Readonly<{
  data?: readonly Readonly<{
    index?: unknown;
    embedding?: unknown;
  }>[];
  usage?: Readonly<Record<string, unknown>>;
}>;

export type OpenAiCompatibleFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type OpenAiCompatibleTransportConfig = Readonly<{
  baseUrl: string;
  credential: string;
  timeoutMs: number;
  fetcher?: OpenAiCompatibleFetch;
}>;

export class OpenAiCompatibleProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAiCompatibleProtocolError";
  }
}

const validateConfig = (config: OpenAiCompatibleTransportConfig): void => {
  if (config.baseUrl.trim().length === 0) {
    throw new Error("OpenAI-compatible base URL must be non-empty");
  }
  if (config.credential.trim().length === 0) {
    throw new Error("OpenAI-compatible credential must be non-empty");
  }
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1) {
    throw new Error("OpenAI-compatible timeout must be positive");
  }
};

const responseBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const safeErrorCode = (value: unknown): string => {
  if (!isRecord(value)) return "provider_http_error";
  const error = value.error;
  if (!isRecord(error) || typeof error.code !== "string") {
    return "provider_http_error";
  }
  return error.code.slice(0, MAX_PROVIDER_ERROR_CODE_LENGTH);
};

const retryableStatus = (status: number): boolean =>
  status === RATE_LIMIT_STATUS || status >= RETRYABLE_STATUS_MIN;

const assertResponse = async (
  response: Response,
  operation: ReportAssistantProviderOperation,
): Promise<unknown> => {
  const body = await responseBody(response);
  if (!response.ok) {
    throw new ReportAssistantProviderError(
      operation,
      new Error(safeErrorCode(body)),
      response.status,
      retryableStatus(response.status),
    );
  }
  return body;
};

const requestJson = async (
  config: OpenAiCompatibleTransportConfig,
  path: string,
  body: unknown,
  operation: ReportAssistantProviderOperation,
): Promise<unknown> => {
  const fetcher = config.fetcher ?? fetch;
  try {
    const response = await fetcher(
      `${config.baseUrl.endsWith("/") ? config.baseUrl.slice(0, -1) : config.baseUrl}/${path}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.credential}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(config.timeoutMs),
      },
    );
    return await assertResponse(response, operation);
  } catch (error) {
    if (error instanceof ReportAssistantProviderError) throw error;
    throw new ReportAssistantProviderError(operation, error, undefined, true);
  }
};

const asObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value))
    throw new OpenAiCompatibleProtocolError(`${label} is invalid`);
  return value;
};

const normalizedUsage = (value: unknown): ReportAssistantTokenUsage => {
  const usage = asObject(value, "Provider usage");
  const promptTokens = usage.prompt_tokens;
  const completionTokens = usage.completion_tokens;
  const totalTokens = usage.total_tokens;
  const tokenValue = (token: unknown): number => {
    if (typeof token !== "number" || !Number.isInteger(token) || token < 0) {
      throw new OpenAiCompatibleProtocolError("Provider usage is invalid");
    }
    return token;
  };
  return {
    promptTokens: tokenValue(promptTokens),
    completionTokens: tokenValue(completionTokens),
    totalTokens: tokenValue(totalTokens),
  };
};

export class OpenAiCompatibleTransport {
  constructor(private readonly config: OpenAiCompatibleTransportConfig) {
    validateConfig(config);
  }

  async chat(
    request: OpenAiCompatibleChatRequest,
    operation: ReportAssistantProviderOperation,
  ): Promise<OpenAiCompatibleChatResponse> {
    const value = await requestJson(
      this.config,
      "chat/completions",
      {
        model: request.model,
        max_tokens: request.maxTokens,
        messages: request.messages,
        ...(request.tools ? { tools: request.tools } : {}),
        ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
        ...(request.parallelToolCalls === undefined
          ? {}
          : { parallel_tool_calls: request.parallelToolCalls }),
        ...(request.responseFormat
          ? { response_format: request.responseFormat }
          : {}),
      },
      operation,
    );
    return asObject(value, "Provider chat response");
  }

  async embeddings(
    model: string,
    input: readonly string[],
  ): Promise<OpenAiCompatibleEmbeddingResponse> {
    const value = await requestJson(
      this.config,
      "embeddings",
      { model, input },
      "embedding",
    );
    return asObject(value, "Provider embedding response");
  }

  static usage(value: unknown): ReportAssistantTokenUsage {
    return normalizedUsage(value);
  }
}
