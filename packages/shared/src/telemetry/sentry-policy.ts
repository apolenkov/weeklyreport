// Keeps the privacy and errors-only contract across Sentry runtimes.
// See openspec/specs/error-trace-correlation and backlog decision-145.

// Sentry 11 deprecated `beforeSendTransaction` and removes it in v12;
// `ignoreSpans` is the non-deprecated replacement for filtering spans in both
// trace lifecycles. A match on the transaction's root span drops the whole
// transaction before send, so Bugsink keeps receiving errors only. Matching by
// both name and op covers a root span regardless of which field it sets.
// The static lifecycle stays because the browser needs its sampled, recording
// root span for the `sentry-trace` header that carries the trace id to the api;
// ignoring the root at span start in the streaming lifecycle would replace it
// with a non-recording span and propagate an unsampled trace.
const ignoredSpanPatterns = [/.*/u, { op: /.*/u }];

/** Sentry options shared by every runtime: restricted automatic data
 * collection, plus catch-all span filters that drop transactions before send
 * so Bugsink keeps receiving errors only.
 */
export function createSentryPrivacyOptions() {
  const deniedMetadataKeys = ["forwarded", "-ip", "remote-", "via", "-user"];

  return {
    // Bugsink accepts errors only; `ignoreSpans` drops the transaction event.
    traceLifecycle: "static" as const,
    ignoreSpans: ignoredSpanPatterns,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: deniedMetadataKeys },
        response: { deny: deniedMetadataKeys },
      },
      httpBodies: [],
      urlQueryParams: { deny: deniedMetadataKeys },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    },
  };
}
