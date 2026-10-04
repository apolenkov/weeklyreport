import timers from "node:timers/promises";

import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";

const MAX_TRANSIENT_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 100;
const MAX_RETRY_DELAY_MS = 1000;
const MAX_SYNCHRONOUS_RETRY_WAIT_MS = 5000;

const retryDelay = (attempt: number): number =>
  Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);

const attemptWithTransientRetry = async <T>(
  action: () => Promise<T>,
  attempt: number,
  remainingWaitMs: number,
  signal?: AbortSignal,
): Promise<T> => {
  signal?.throwIfAborted();
  try {
    return await action();
  } catch (error) {
    if (
      !(error instanceof ReportAssistantProviderError) ||
      !error.retryable ||
      // A network failure or timeout has no HTTP status: repeating it only
      // multiplies the connect/timeout wait (3x) while the user watches a
      // spinner, so it fails fast with the retryable provider outcome.
      error.statusCode === undefined ||
      attempt >= MAX_TRANSIENT_ATTEMPTS - 1
    ) {
      throw error;
    }
    const waitMs = error.retryAfterMs ?? retryDelay(attempt);
    if (waitMs > remainingWaitMs) throw error;
    await timers.setTimeout(waitMs, undefined, { signal });
    return attemptWithTransientRetry(
      action,
      attempt + 1,
      remainingWaitMs - waitMs,
      signal,
    );
  }
};

export const withTransientRetry = <T>(
  action: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> =>
  attemptWithTransientRetry(action, 0, MAX_SYNCHRONOUS_RETRY_WAIT_MS, signal);
