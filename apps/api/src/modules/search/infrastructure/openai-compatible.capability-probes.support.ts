import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";
import { safeFailureCode } from "./openai-compatible.answer-probe.js";
import type { OpenAiCompatibleTransport } from "./openai-compatible.transport.js";
import { OpenAiCompatibleProtocolError } from "./openai-compatible.transport.js";

export type Capability =
  | "authentication"
  | "structured_planner"
  | "planner_tool_call"
  | "structured_answer"
  | "token_usage"
  | "batch_embeddings";

export type CapabilityStatus = "passed" | "failed" | "inconclusive";

export type CapabilityProbeResult = Readonly<{
  capability: Capability;
  status: CapabilityStatus;
  failureCode?: string;
}>;

export type GenerationLaneResult = Readonly<{
  status: CapabilityStatus;
  capabilities: readonly CapabilityProbeResult[];
  connectionFailed: boolean;
}>;

export type EmbeddingLaneResult = Readonly<{
  status: CapabilityStatus;
  capabilities: readonly CapabilityProbeResult[];
  dimensions: number | null;
  connectionFailed: boolean;
}>;

export const statusOf = (
  results: readonly CapabilityProbeResult[],
): CapabilityStatus =>
  results.some(({ status }) => status === "failed")
    ? "failed"
    : results.some(({ status }) => status === "inconclusive")
      ? "inconclusive"
      : "passed";

export const failureStatus = (error: unknown): CapabilityStatus =>
  error instanceof ReportAssistantProviderError && error.retryable
    ? "inconclusive"
    : "failed";

export const failureResult = (
  capability: Capability,
  error: unknown,
): CapabilityProbeResult => {
  const authenticationFailure =
    error instanceof ReportAssistantProviderError &&
    [HTTP_UNAUTHORIZED, HTTP_FORBIDDEN].includes(error.statusCode ?? 0);
  return {
    capability,
    status: failureStatus(error),
    failureCode: authenticationFailure
      ? "provider_authentication_failed"
      : safeFailureCode(error),
  };
};

export const isConnectionFailure = (error: unknown): boolean =>
  error instanceof ReportAssistantProviderError &&
  (error.statusCode === undefined ||
    error.retryable ||
    [HTTP_UNAUTHORIZED, HTTP_FORBIDDEN].includes(error.statusCode));

export const isAuthenticationFailure = (error: unknown): boolean =>
  error instanceof ReportAssistantProviderError &&
  [HTTP_UNAUTHORIZED, HTTP_FORBIDDEN].includes(error.statusCode ?? 0);

export const embeddingContract = async (
  transport: OpenAiCompatibleTransport,
  model: string,
): Promise<Readonly<{ dimensions: number }>> => {
  const response = await transport.embeddings(model, [
    "Synthetic document A",
    "Synthetic document B",
  ]);
  const documents = response.data ?? [];
  if (
    documents.length !== 2 ||
    new Set(documents.map(({ index }) => index)).size !== 2 ||
    documents.some(({ index }) => index !== 0 && index !== 1)
  ) {
    throw new OpenAiCompatibleProtocolError("embedding_order_invalid");
  }
  const vectors = documents.map(({ embedding }) => embedding);
  const firstVector = vectors[0];
  if (!Array.isArray(firstVector)) {
    throw new OpenAiCompatibleProtocolError("embedding_vector_invalid");
  }
  const dimensions = firstVector.length;
  // A zero vector has no defined cosine distance, so a lane that returns one
  // can never rank: it fails the contract instead of marking readiness passed.
  if (
    !Number.isInteger(dimensions) ||
    dimensions < 1 ||
    vectors.some(
      (vector) =>
        !Array.isArray(vector) ||
        vector.length !== dimensions ||
        vector.some(
          (value) => typeof value !== "number" || !Number.isFinite(value),
        ) ||
        !vector.some((value) => value !== 0),
    )
  ) {
    throw new OpenAiCompatibleProtocolError("embedding_vector_invalid");
  }
  const totalTokens = response.usage?.total_tokens;
  if (
    typeof totalTokens !== "number" ||
    !Number.isInteger(totalTokens) ||
    totalTokens < 0
  ) {
    throw new OpenAiCompatibleProtocolError("embedding_usage_invalid", "usage");
  }
  return { dimensions };
};

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
