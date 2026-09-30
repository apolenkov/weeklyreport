import type {
  ReportAssistantProviderOperation,
  ReportAssistantTokenUsage,
} from "../application/report-assistant.ports.js";
import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";
import {
  ProviderResponseTooLargeError,
  readProviderResponseBody,
} from "./openai-compatible.response-body.js";
import { withTransientRetry } from "./openai-compatible.retry.js";
import { normalizedUsage } from "./openai-compatible.usage.js";

const RETRYABLE_STATUS_MIN = 500;
const RATE_LIMIT_STATUS = 429;
const MAX_PROVIDER_ERROR_CODE_LENGTH = 100;
const MILLISECONDS_PER_SECOND = 1000;
type OpenAiCompatibleMessage = Readonly<{
  role: "system" | "user" | "assistant";
  content: string;
}>;
type OpenAiCompatibleTool = Readonly<Record<string, unknown>>;
type JsonObjectResponseFormat = Readonly<{ type: "json_object" }>;

export type OpenAiCompatibleChatRequest = Readonly<{
  model: string;
  maxTokens: number;
  messages: readonly OpenAiCompatibleMessage[];
  tools?: readonly OpenAiCompatibleTool[];
  toolChoice?: unknown;
  parallelToolCalls?: boolean;
  responseFormat?: JsonObjectResponseFormat;
  reasoningEffort?: string;
  reasoning?: Readonly<{ effort: string }>;
  temperature?: number;
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
  constructor(
    message: string,
    readonly reason?: "usage",
  ) {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const boundedErrorCode = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0
    ? value.slice(0, MAX_PROVIDER_ERROR_CODE_LENGTH)
    : null;

const safeErrorCode = (value: unknown): string => {
  if (!isRecord(value)) return "provider_http_error";
  const error = value.error;
  if (!isRecord(error)) return "provider_http_error";
  const metadata = error.metadata;
  const typedCode = isRecord(metadata)
    ? (boundedErrorCode(metadata.provider_code) ??
      boundedErrorCode(metadata.error_type))
    : null;
  return (
    typedCode ??
    boundedErrorCode(error.code) ??
    (typeof error.code === "number" && Number.isInteger(error.code)
      ? `provider_http_${error.code}`
      : "provider_http_error")
  );
};

const retryableStatus = (status: number): boolean =>
  status === RATE_LIMIT_STATUS || status >= RETRYABLE_STATUS_MIN;

const retryAfterMilliseconds = (response: Response): number | undefined => {
  if (response.status !== RATE_LIMIT_STATUS) return undefined;
  const seconds = Number.parseFloat(response.headers.get("retry-after") ?? "");
  const milliseconds = seconds * MILLISECONDS_PER_SECOND;
  return Number.isFinite(milliseconds) && milliseconds >= 0
    ? milliseconds
    : undefined;
};

const assertResponse = async (
  response: Response,
  operation: ReportAssistantProviderOperation,
): Promise<unknown> => {
  const body = await readProviderResponseBody(response).catch(
    (error: unknown) => {
      if (!(error instanceof ProviderResponseTooLargeError)) throw error;
      throw new ReportAssistantProviderError(
        operation,
        error,
        response.status,
        false,
        "provider_response_too_large",
        retryAfterMilliseconds(response),
      );
    },
  );
  if (!response.ok) {
    const errorCode = safeErrorCode(body);
    throw new ReportAssistantProviderError(
      operation,
      new Error(errorCode),
      response.status,
      retryableStatus(response.status),
      errorCode,
      retryAfterMilliseconds(response),
    );
  }
  return body;
};

const requestJsonOnce = async (
  config: OpenAiCompatibleTransportConfig,
  path: string,
  body: unknown,
  operation: ReportAssistantProviderOperation,
  signal?: AbortSignal,
): Promise<unknown> => {
  const fetcher = config.fetcher ?? fetch;
  try {
    signal?.throwIfAborted();
    const timeoutSignal = AbortSignal.timeout(config.timeoutMs);
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
        signal: signal
          ? AbortSignal.any([signal, timeoutSignal])
          : timeoutSignal,
      },
    );
    return await assertResponse(response, operation);
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof ReportAssistantProviderError) throw error;
    throw new ReportAssistantProviderError(operation, error, undefined, true);
  }
};

const requestJson = (
  config: OpenAiCompatibleTransportConfig,
  path: string,
  body: unknown,
  operation: ReportAssistantProviderOperation,
  signal?: AbortSignal,
): Promise<unknown> =>
  withTransientRetry(
    () => requestJsonOnce(config, path, body, operation, signal),
    signal,
  );

const asObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value))
    throw new OpenAiCompatibleProtocolError(`${label} is invalid`);
  return value;
};

export class OpenAiCompatibleTransport {
  constructor(private readonly config: OpenAiCompatibleTransportConfig) {
    validateConfig(config);
  }

  async chat(
    request: OpenAiCompatibleChatRequest,
    operation: ReportAssistantProviderOperation,
    signal?: AbortSignal,
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
        ...(request.reasoningEffort
          ? { reasoning_effort: request.reasoningEffort }
          : {}),
        ...(request.reasoning ? { reasoning: request.reasoning } : {}),
        ...(request.temperature === undefined
          ? {}
          : { temperature: request.temperature }),
      },
      operation,
      signal,
    );
    return asObject(value, "Provider chat response");
  }

  async embeddings(
    model: string,
    input: readonly string[],
    signal?: AbortSignal,
  ): Promise<OpenAiCompatibleEmbeddingResponse> {
    const value = await requestJson(
      this.config,
      "embeddings",
      { model, input },
      "embedding",
      signal,
    );
    return asObject(value, "Provider embedding response");
  }

  static usage(value: unknown): ReportAssistantTokenUsage {
    return normalizedUsage(
      value,
      () =>
        new OpenAiCompatibleProtocolError("Provider usage is invalid", "usage"),
    );
  }
}
