/**
 * Keeps the privacy and errors-only contract across Sentry runtimes.
 * See openspec/specs/error-trace-correlation and backlog decision-145.
 */
export function createSentryPrivacyOptions() {
  const deniedMetadataKeys = ["forwarded", "-ip", "remote-", "via", "-user"];

  return {
    // Bugsink accepts errors only; transaction mode keeps its discard hook active.
    traceLifecycle: "static" as const,
    // Only runs under the static lifecycle above. The SDK marks it deprecated
    // (removed in v12; migration tracked in TASK-716), so it lives here once
    // for every runtime instead of at four typed init call sites.
    beforeSendTransaction: () => null,
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
