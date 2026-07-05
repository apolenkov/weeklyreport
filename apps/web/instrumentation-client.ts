import * as Sentry from "@sentry/nextjs";

import { webEnv } from "./src/lib/web-env";

// correlate-errors-to-traces: the browser must emit a `sentry-trace` header on
// same-origin api calls so the api adopts the browser's trace id (one id end to
// end). browserTracing needs a non-zero sample rate to start a trace and attach
// that header. 1.0 in dev; no production point exists yet, so production
// sampling is deferred — see openspec/changes/correlate-errors-to-traces.
const BROWSER_TRACES_SAMPLE_RATE = 1;

Sentry.init({
  dsn: webEnv.sentryDsn(),
  environment: process.env.NODE_ENV,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: BROWSER_TRACES_SAMPLE_RATE,
  // Same-origin api paths the browser calls (Next rewrites them to the api).
  // Only these carry the propagation header — keeps it off cross-origin URLs.
  tracePropagationTargets: [/^\/(?:trpc|auth|api)(?:\/|$)/],
  // Bugsink stores errors only — drop browser transactions before they send.
  beforeSendTransaction: () => null,
});

// App Router navigation instrumentation (Next 15+/SDK 10).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
