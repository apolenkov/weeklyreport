import { createSentryPrivacyOptions } from "@customreport/shared";
import * as Sentry from "@sentry/nestjs";

import { envSchema } from "../infrastructure/config/env.schema.js";
import { stampActiveTrace } from "../infrastructure/otel/sentry-trace-correlation.js";
import { parseSentryDsn } from "../lib/sentry-dsn.js";

export function initializeSentry(): void {
  const nodeEnv = envSchema.shape.NODE_ENV.safeParse(process.env.NODE_ENV);
  if (!nodeEnv.success) {
    console.error(
      "Invalid environment configuration: NODE_ENV must be one of development, production, test.",
    );
    process.exit(1);
  }
  // A malformed configured DSN fails loudly here, before Sentry.init would
  // log the raw value and build a client that reports nothing.
  const dsn = parseSentryDsn(process.env.SENTRY_DSN);
  if (dsn === undefined) return;

  Sentry.init({
    ...createSentryPrivacyOptions(),
    dsn,
    tracesSampleRate: 0,
    enableOpenTelemetrySetup: false,
    environment: nodeEnv.data,
    beforeSend: stampActiveTrace,
    beforeSendTransaction: () => null,
  });
}

export async function shutdownSentry(timeoutMs: number): Promise<void> {
  if (!Sentry.isInitialized()) return;
  if (!(await Sentry.close(timeoutMs)))
    throw new Error("Sentry did not flush before the shutdown deadline");
}
