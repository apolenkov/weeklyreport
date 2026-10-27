// Keeps the privacy and errors-only contract across Sentry runtimes.
// See openspec/specs/error-trace-correlation and backlog decision-145.

// `ignoreSpans` matches the transaction's root span by name or op and drops the
// whole transaction before send, so Bugsink keeps receiving errors only. A root
// with neither a name nor an op passes the filter; the roots the SDK creates
// carry both. The static lifecycle stays because the browser needs its sampled,
// recording root span for the `sentry-trace` header that carries the trace id to
// the api; ignoring the root at span start in the streaming lifecycle would
// replace it with a non-recording span and propagate an unsampled trace.
const ignoredSpanPatterns = [/.*/u, { op: /.*/u }];

/** Sentry options shared by every runtime: restricted automatic data
 * collection, plus root-span name and op filters that drop matched transactions
 * before send so Bugsink keeps receiving errors only.
 */
export function createSentryPrivacyOptions() {
  const deniedMetadataKeys = ["forwarded", "-ip", "remote-", "via", "-user"];

  return {
    // Bugsink accepts errors only; `ignoreSpans` drops matched transactions.
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
