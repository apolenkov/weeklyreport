const BULLMQ_GRACEFUL_CLOSE_TIMEOUT_MS = 500;
const BULLMQ_FORCE_CLOSE_TIMEOUT_MS = 500;

type AsyncClose = () => Promise<void>;

async function raceWithDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutError: Error,
): Promise<T> {
  const timeout = Promise.withResolvers<never>();
  const timer = setTimeout(() => timeout.reject(timeoutError), timeoutMs);
  timer.unref();
  try {
    return await Promise.race([operation, timeout.promise]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gives BullMQ a short window to finish its normal close handshake, then calls
 * the caller's fallback. A stuck Redis handshake must not hold the process past
 * the container stop grace period; unfinished jobs are left to BullMQ's
 * stalled-job recovery instead of being deleted.
 */
export async function closeBullMqResource(
  label: string,
  close: AsyncClose,
  forceClose: AsyncClose,
  onLateError?: (error: unknown) => void,
): Promise<void> {
  const graceful = close();
  // Observe every close rejection so a timed-out close never becomes an
  // unhandled rejection. A fallback may return the same pending promise, so
  // each error is reported once.
  const reported = new Set<unknown>();
  const report = (error: unknown): void => {
    if (reported.has(error)) return;
    reported.add(error);
    onLateError?.(error);
  };
  void graceful.catch(report);
  try {
    await raceWithDeadline(
      graceful,
      BULLMQ_GRACEFUL_CLOSE_TIMEOUT_MS,
      new Error(
        `BullMQ ${label} close exceeded ${BULLMQ_GRACEFUL_CLOSE_TIMEOUT_MS}ms`,
      ),
    );
  } catch (error: unknown) {
    const forced = Promise.resolve().then(forceClose);
    void forced.catch(report);
    try {
      await raceWithDeadline(
        forced,
        BULLMQ_FORCE_CLOSE_TIMEOUT_MS,
        new Error(
          `BullMQ ${label} force close exceeded ${BULLMQ_FORCE_CLOSE_TIMEOUT_MS}ms`,
        ),
      );
    } catch (forceError: unknown) {
      throw new AggregateError(
        [error, forceError],
        `BullMQ ${label} force close failed`,
      );
    }
  }
}

export { BULLMQ_FORCE_CLOSE_TIMEOUT_MS, BULLMQ_GRACEFUL_CLOSE_TIMEOUT_MS };
