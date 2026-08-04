import * as Sentry from "@sentry/nestjs";

import { envSchema } from "../infrastructure/config/env.schema.js";
import { stampActiveTrace } from "../infrastructure/otel/sentry-trace-correlation.js";

export function initializeSentry(): void {
  const nodeEnv = envSchema.shape.NODE_ENV.safeParse(process.env.NODE_ENV);
  if (!nodeEnv.success) {
    console.error(
      "Invalid environment configuration: NODE_ENV must be one of development, production, test.",
    );
    process.exit(1);
  }
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
    skipOpenTelemetrySetup: true,
    environment: nodeEnv.data,
    beforeSend: stampActiveTrace,
    beforeSendTransaction: () => null,
  });
}
