import { createRequire } from "node:module";

import { createSentryPrivacyOptions } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

// Vitest resolves Next's Node entrypoint even in jsdom. Follow declared
// dependencies Next -> React -> Browser to load that installed browser SDK.
const require = createRequire(import.meta.url);
const requireSentry = createRequire(require.resolve("@sentry/nextjs"));
const requireReact = createRequire(requireSentry.resolve("@sentry/react"));
// Next's public types re-export these browser APIs through its React SDK.
const {
  BrowserClient,
  breadcrumbsIntegration,
  getCurrentScope,
  getIsolationScope,
  httpContextIntegration,
} = requireReact("@sentry/browser") as Pick<
  typeof import("@sentry/nextjs"),
  | "BrowserClient"
  | "breadcrumbsIntegration"
  | "getCurrentScope"
  | "getIsolationScope"
  | "httpContextIntegration"
>;

// Exercise the installed browser SDK without sending telemetry outside the test.
describe("Sentry SDK privacy", () => {
  it("filters sensitive page query keys before an error reaches transport", async () => {
    const send = vi.fn(() => Promise.resolve({ statusCode: 200 }));
    const client = new BrowserClient({
      ...createSentryPrivacyOptions(),
      dsn: "https://0123456789abcdef@bugsink.test/1",
      integrations: [httpContextIntegration()],
      stackParser: () => [],
      transport: () => ({ send, flush: () => Promise.resolve(true) }),
    });
    window.history.replaceState(
      null,
      "",
      "/report?forwarded=private-marker&remote-user=private-marker&safe=keep",
    );

    try {
      client.init();
      client.captureMessage("controlled privacy test");
      expect(await client.flush(1000)).toBe(true);

      expect(send).toHaveBeenCalledOnce();
      const envelope = JSON.stringify(send.mock.calls);
      expect(envelope).not.toContain("private-marker");
      expect(envelope).toContain("safe=keep");
    } finally {
      await client.close();
      window.history.replaceState(null, "", "/");
    }
  });

  it("filters navigation breadcrumb URLs before an error reaches transport", async () => {
    const send = vi.fn(() => Promise.resolve({ statusCode: 200 }));
    const client = new BrowserClient({
      ...createSentryPrivacyOptions(),
      dsn: "https://0123456789abcdef@bugsink.test/1",
      integrations: [breadcrumbsIntegration({ history: true })],
      stackParser: () => [],
      transport: () => ({ send, flush: () => Promise.resolve(true) }),
    });
    const scope = getCurrentScope();
    const isolationScope = getIsolationScope();
    const previousClient = scope.getClient();

    try {
      scope.setClient(client);
      isolationScope.clearBreadcrumbs();
      client.init();
      window.history.pushState(
        null,
        "",
        "/next?forwarded=navigation-private-marker&remote-user=navigation-private-marker&safe=navigation-keep",
      );
      const breadcrumbs = isolationScope
        .getScopeData()
        .breadcrumbs.filter(
          (breadcrumb) => breadcrumb.category === "navigation",
        );
      expect(breadcrumbs).toHaveLength(1);
      expect(breadcrumbs[0]?.data?.to).toContain("safe=navigation-keep");
      expect(JSON.stringify(breadcrumbs)).not.toContain(
        "navigation-private-marker",
      );

      client.captureMessage(
        "controlled navigation privacy test",
        "error",
        {},
        scope,
      );
      expect(await client.flush(1000)).toBe(true);
      expect(send).toHaveBeenCalledOnce();
      const envelope = JSON.stringify(send.mock.calls);
      expect(envelope).toContain("navigation-keep");
      expect(envelope).not.toContain("navigation-private-marker");
    } finally {
      await client.close();
      scope.setClient(previousClient);
      isolationScope.clearBreadcrumbs();
      window.history.replaceState(null, "", "/");
    }
  });

  it("drops transactions through the shared span filter, not the deprecated hook", async () => {
    const send = vi.fn(() => Promise.resolve({ statusCode: 200 }));
    const client = new BrowserClient({
      ...createSentryPrivacyOptions(),
      dsn: "https://0123456789abcdef@bugsink.test/1",
      integrations: [],
      stackParser: () => [],
      transport: () => ({ send, flush: () => Promise.resolve(true) }),
      tracesSampleRate: 1,
    });

    try {
      client.init();
      expect(client.getOptions()).not.toHaveProperty("beforeSendTransaction");
      expect(client.getOptions().ignoreSpans).toContainEqual(/.*/u);

      client.captureEvent({ type: "transaction", transaction: "controlled" });
      // Empty name exercises the `op` catch-all, which must also drop the root.
      client.captureEvent({
        type: "transaction",
        transaction: "",
        contexts: {
          trace: {
            trace_id: "11111111111111111111111111111111",
            span_id: "2222222222222222",
            op: "http.server",
          },
        },
      });
      expect(await client.flush(1000)).toBe(true);
      expect(send).not.toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });
});
