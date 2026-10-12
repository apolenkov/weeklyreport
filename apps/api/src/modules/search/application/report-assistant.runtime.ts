import {
  type ReportAssistantOutcome,
  reportAssistantOutcomeSchema,
} from "@customreport/shared";

import { GroundingContextBudgetExceededError } from "../domain/context-builder.js";
import {
  PROVIDER_RESPONSE_INCOMPLETE,
  ReportAssistantProviderError,
} from "./report-assistant.ports.js";

const HTTP_TOO_MANY_REQUESTS = 429;
const MILLISECONDS_PER_SECOND = 1000;
const LEASE_LOSS_RETRY_AFTER_SECONDS = 1;

export type ReportAssistantConfig = Readonly<{
  candidateLimit: number;
  exhaustiveLimit: number;
  contextTokenBudget: number;
  model: string;
  timeZone: string;
}>;

export type ReportAssistantClock = Readonly<{ now: Date }>;

const providerUnavailable = (
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

/** Maps a thrown failure to a product outcome, or null for a technical error. */
export const failureOutcome = (
  error: unknown,
  signals: Readonly<{ lease: AbortSignal; deadline: AbortSignal }>,
): ReportAssistantOutcome | null => {
  if (signals.lease.aborted) {
    return reportAssistantOutcomeSchema.parse({
      kind: "resource_limited",
      retryAfterSeconds: LEASE_LOSS_RETRY_AFTER_SECONDS,
    });
  }
  if (signals.deadline.aborted) return { kind: "provider_unavailable" };
  if (error instanceof GroundingContextBudgetExceededError) {
    return { kind: "result_set_too_large" };
  }
  if (!(error instanceof ReportAssistantProviderError)) return null;
  if (error.providerCode === PROVIDER_RESPONSE_INCOMPLETE) {
    return { kind: "provider_response_incomplete" };
  }
  return error.retryable ? providerUnavailable(error) : null;
};

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
