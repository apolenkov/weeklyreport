/// <reference types="node" />

// Runtime-neutral Sentry options shared by the edge and server entrypoints,
// so DSN selection and sampling policy cannot drift between the two.
export function createSentryInitOptions() {
  return {
    dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
    environment: process.env.NODE_ENV,
    // Bugsink stores errors only — drop transactions.
    beforeSendTransaction: () => null,
  };
}
