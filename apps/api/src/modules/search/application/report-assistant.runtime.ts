import {
  type ReportAssistantOutcome,
  reportAssistantOutcomeSchema,
} from "@customreport/shared";

import type { ReportAssistantProviderError } from "./report-assistant.ports.js";

const HTTP_TOO_MANY_REQUESTS = 429;
const MILLISECONDS_PER_SECOND = 1000;

export type ReportAssistantConfig = Readonly<{
  candidateLimit: number;
  exhaustiveLimit: number;
  contextTokenBudget: number;
  model: string;
  timeZone: string;
}>;

export type ReportAssistantClock = Readonly<{ now: Date }>;

export const providerUnavailable = (
  error: ReportAssistantProviderError,
): ReportAssistantOutcome =>
  reportAssistantOutcomeSchema.parse({
    kind: "provider_unavailable",
    ...(error.statusCode === HTTP_TOO_MANY_REQUESTS &&
    error.retryAfterMs !== undefined
      ? {
          rateLimit: {
            retryAfterSeconds: Math.ceil(
              error.retryAfterMs / MILLISECONDS_PER_SECOND,
            ),
          },
        }
      : {}),
  });

export const createReportAssistantClock = (): ReportAssistantClock => ({
  get now(): Date {
    return new Date();
  },
});

export const resolveReportAssistantTimeZone = (): string => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone.length === 0) throw new Error("Server timezone is unavailable");
  return timeZone;
};
