// Runs before the app (and its shutdown coordinator) exists. Imports stay
// dynamic: static imports would load OTel and Sentry before main.ts runs
// initializeSentry() and startOtel().
const TELEMETRY_DRAIN_TIMEOUT_MS = 1500;

export async function handleBootFailure(
  error: unknown,
  exit: (code: number) => void = (code) => process.exit(code),
): Promise<void> {
  console.error(error);
  // Captured before the Sentry flush below; a capture fault must not skip the
  // drain or replace the original failure.
  try {
    const Sentry = await import("@sentry/nestjs");
    Sentry.captureException(error);
  } catch (captureError: unknown) {
    try {
      process.stderr.write(
        `[boot] failed to capture boot failure: ${String(captureError)}\n`,
      );
    } catch {
      // stderr closed/refused; continue to telemetry drain
    }
  }
  // Bounded, and never masking the original failure, which still exits 1.
  try {
    const { shutdownOtel } =
      await import("../infrastructure/otel/otel.bootstrap.js");
    const { shutdownSentry } = await import("./sentry-bootstrap.js");
    await Promise.allSettled([
      shutdownOtel(),
      shutdownSentry(TELEMETRY_DRAIN_TIMEOUT_MS),
    ]);
  } finally {
    exit(1);
  }
}
