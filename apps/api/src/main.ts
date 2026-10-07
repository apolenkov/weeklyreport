import "reflect-metadata";

async function start(): Promise<void> {
  const { initializeSentry } = await import("./bootstrap/sentry-bootstrap.js");
  initializeSentry();
  const { startOtel } = await import("./infrastructure/otel/otel.bootstrap.js");
  const otelDecision = startOtel();
  const { bootstrapApi } = await import("./bootstrap/api-bootstrap.js");
  await bootstrapApi(otelDecision);
}

const TELEMETRY_DRAIN_TIMEOUT_MS = 1500;

start().catch(async (error: unknown) => {
  console.error(error);
  // A failure before the app exists leaves no shutdown coordinator behind;
  // drain the telemetry that may already be initialized — bounded, never
  // masking the original failure, which still exits 1.
  try {
    const { shutdownOtel } =
      await import("./infrastructure/otel/otel.bootstrap.js");
    const { shutdownSentry } = await import("./bootstrap/sentry-bootstrap.js");
    await Promise.allSettled([
      shutdownOtel(),
      shutdownSentry(TELEMETRY_DRAIN_TIMEOUT_MS),
    ]);
  } finally {
    process.exit(1);
  }
});
