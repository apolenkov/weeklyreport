import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";

const MAX_TRANSIENT_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 100;
const MAX_RETRY_DELAY_MS = 1000;
const MAX_SYNCHRONOUS_RETRY_WAIT_MS = 5000;

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const retryDelay = (attempt: number): number =>
  Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);

const attemptWithTransientRetry = async <T>(
  action: () => Promise<T>,
  attempt: number,
  remainingWaitMs: number,
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    if (
      !(error instanceof ReportAssistantProviderError) ||
      !error.retryable ||
      attempt >= MAX_TRANSIENT_ATTEMPTS - 1
    ) {
      throw error;
    }
    const waitMs = error.retryAfterMs ?? retryDelay(attempt);
    if (waitMs > remainingWaitMs) throw error;
    await delay(waitMs);
    return attemptWithTransientRetry(
      action,
      attempt + 1,
      remainingWaitMs - waitMs,
    );
  }
};

export const withTransientRetry = <T>(action: () => Promise<T>): Promise<T> =>
  attemptWithTransientRetry(action, 0, MAX_SYNCHRONOUS_RETRY_WAIT_MS);
