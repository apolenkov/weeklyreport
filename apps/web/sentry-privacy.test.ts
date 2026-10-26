import { createRequire } from "node:module";

import { createSentryPrivacyOptions } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

// Vitest resolves Next's Node entrypoint even in jsdom. Load the browser SDK
// owned by that exact installed Next SDK, without adding a separate dependency.
const require = createRequire(import.meta.url);
const requireSentry = createRequire(require.resolve("@sentry/nextjs"));
const { BrowserClient, httpContextIntegration } = requireSentry(
  "@sentry/browser",
) as typeof import("@sentry/nextjs");

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

  it("drops transactions with the shared static lifecycle policy", async () => {
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
      client.captureEvent({ type: "transaction", transaction: "controlled" });
      expect(await client.flush(1000)).toBe(true);
      expect(send).not.toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });
});
