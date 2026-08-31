import type { ReportAssistantTokenUsage } from "../application/report-assistant.ports.js";

const asObject = (
  value: unknown,
  invalid: () => Error,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    throw invalid();
  }
  return value as Record<string, unknown>;
};

const tokenValue = (token: unknown, invalid: () => Error): number => {
  if (typeof token !== "number" || !Number.isInteger(token) || token < 0) {
    throw invalid();
  }
  return token;
};

export const normalizedUsage = (
  value: unknown,
  invalid: () => Error,
): ReportAssistantTokenUsage => {
  const usage = asObject(value, invalid);
  return {
    promptTokens: tokenValue(usage.prompt_tokens, invalid),
    completionTokens: tokenValue(usage.completion_tokens, invalid),
    totalTokens: tokenValue(usage.total_tokens, invalid),
  };
};
