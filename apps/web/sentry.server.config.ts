import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.NODE_ENV,
  // correlate-errors-to-traces: Bugsink stores errors only — drop transactions.
  beforeSendTransaction: () => null,
});
