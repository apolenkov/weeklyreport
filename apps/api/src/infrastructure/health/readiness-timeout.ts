// Every dependency probe gets the same upper bound so /health/ready cannot
// hang on a half-open database or Redis connection.
export const READINESS_PROBE_TIMEOUT_MS = 2000;

export async function withReadinessTimeout<T>(
  label: string,
  operation: Promise<T>,
): Promise<T> {
  const timeout = Promise.withResolvers<never>();
  const timer = setTimeout(
    () =>
      timeout.reject(
        new Error(
          `${label} probe timed out after ${READINESS_PROBE_TIMEOUT_MS}ms`,
        ),
      ),
    READINESS_PROBE_TIMEOUT_MS,
  );
  timer.unref();

  try {
    return await Promise.race([operation, timeout.promise]);
  } finally {
    clearTimeout(timer);
  }
}
