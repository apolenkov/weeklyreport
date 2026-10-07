/// <reference types="node" />

import { createSentryPrivacyOptions } from "@customreport/shared";
import { z } from "zod";

// Runtime-neutral Sentry options shared by the edge and server entrypoints,
// so DSN selection and sampling policy cannot drift between the two.
// Browser errors use this same-origin endpoint so the enforcing edge CSP can
// keep `connect-src 'self'` without exposing the Bugsink/Sentry origin.
export const BROWSER_SENTRY_TUNNEL = "/monitoring";

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalSentryDsn = z.preprocess(emptyToUndefined, z.url().optional());

const sentryRuntimeEnvSchema = z.object({
  SENTRY_DSN: optionalSentryDsn,
  NEXT_PUBLIC_SENTRY_DSN: optionalSentryDsn,
});

function readSentryRuntimeEnv(): z.infer<typeof sentryRuntimeEnvSchema> {
  const result = sentryRuntimeEnvSchema.safeParse({
    SENTRY_DSN: process.env.SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  if (!result.success) {
    throw new Error(
      `Invalid Sentry environment:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

export function createSentryInitOptions() {
  const env = readSentryRuntimeEnv();

  return {
    ...createSentryPrivacyOptions(),
    // The server DSN is authoritative when both are configured. Both values
    // are parsed before selection so a malformed configured value never hides.
    dsn: env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
    environment: process.env.NODE_ENV,
    // Bugsink stores errors only — drop transactions.
    beforeSendTransaction: () => null,
  };
}
