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
 * Gives BullMQ a short window to finish its normal close handshake, then uses
 * its documented force/disconnect operation. A stuck Redis handshake must not
 * hold the process past the container stop grace period; force-closing leaves
 * active jobs for BullMQ's normal stalled-job recovery instead of deleting
 * them.
 */
export async function closeBullMqResource(
  label: string,
  close: AsyncClose,
  forceClose: AsyncClose,
  onLateError?: (error: unknown) => void,
): Promise<void> {
  const graceful = close();
  // A timed-out close can reject after forceClose has completed. Observe that
  // late rejection so shutdown never creates an unhandled rejection.
  void graceful.catch((error: unknown) => {
    onLateError?.(error);
  });
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
    void forced.catch((lateError: unknown) => {
      onLateError?.(lateError);
    });
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
