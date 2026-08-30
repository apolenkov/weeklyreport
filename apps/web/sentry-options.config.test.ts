import { afterEach, describe, expect, it, vi } from "vitest";

import { createSentryInitOptions } from "./sentry-options.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createSentryInitOptions", () => {
  it("accepts absent and empty DSNs", () => {
    vi.stubEnv("SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", " ".repeat(3));

    expect(createSentryInitOptions().dsn).toBeUndefined();
  });

  it("uses the server DSN when both valid DSNs are configured", () => {
    vi.stubEnv("SENTRY_DSN", "https://server-key@bugsink.test/1");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://browser-key@bugsink.test/2");

    expect(createSentryInitOptions().dsn).toBe(
      "https://server-key@bugsink.test/1",
    );
  });

  it.each([
    ["SENTRY_DSN", "SENTRY_DSN"],
    ["NEXT_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"],
  ])("rejects a malformed %s", (variable, label) => {
    vi.stubEnv(variable, "not-a-url");

    expect(() => createSentryInitOptions()).toThrow(label);
  });
});
