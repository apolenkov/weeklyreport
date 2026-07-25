// Must stay the first import: it configures zod before any module that parses
// a schema at load time (web-env does), and imports are hoisted above
// statements, so this cannot be a call in the body below.
import "./src/lib/zod-jitless";

import * as Sentry from "@sentry/nextjs";

import { webEnv } from "./src/lib/web-env";

// Non-zero sample rate so browserTracing emits sentry-trace on same-origin
// api calls (one id end-to-end). Prod sampling: openspec/specs/prod-trace-sampling.
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
