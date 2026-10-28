import "reflect-metadata";

import { handleBootFailure } from "./bootstrap/boot-failure.js";

async function start(): Promise<void> {
  const { initializeSentry } = await import("./bootstrap/sentry-bootstrap.js");
  initializeSentry();
  const { startOtel } = await import("./infrastructure/otel/otel.bootstrap.js");
  const otelDecision = startOtel();
  const { bootstrapApi } = await import("./bootstrap/api-bootstrap.js");
  await bootstrapApi(otelDecision);
}

start().catch((error: unknown) => handleBootFailure(error));
