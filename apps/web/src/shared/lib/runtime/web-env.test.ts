import { afterEach, describe, expect, it, vi } from "vitest";

import { assertWebEnv, webEnv, webEnvSchema } from "./web-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("webEnvSchema", () => {
  it("rejects a malformed toggle instead of coercing it to off", () => {
    const result = webEnvSchema.safeParse({
      NEXT_PUBLIC_DEV_ROLE_SWITCHER: "ture",
    });
    expect(result.success).toBe(false);
  });

  it("validates the product feedback toggle", () => {
    expect(
      webEnvSchema.safeParse({
        NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED: "enabled",
      }).success,
    ).toBe(false);
    expect(
      webEnvSchema.safeParse({
        NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED: "true",
      }).success,
    ).toBe(true);
  });

  it("validates the product feedback inbox role allowlist", () => {
    expect(
      webEnvSchema.safeParse({
        NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES: "admin,head",
      }).success,
    ).toBe(true);
    expect(
      webEnvSchema.safeParse({
        NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES: "admin,owner",
      }).success,
    ).toBe(false);
    expect(
      webEnvSchema.safeParse({
        NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES: "admin,admin",
      }).success,
    ).toBe(false);
  });

  it("accepts an absent toggle (optional, no default)", () => {
    const result = webEnvSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("maps an empty string to unset before validating a URL field", () => {
    const result = webEnvSchema.safeParse({ NEXT_PUBLIC_SENTRY_DSN: "" });
    expect(result.success).toBe(true);
    expect(result.data?.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
  });

  it("rejects a non-URL DSN", () => {
    const result = webEnvSchema.safeParse({
      NEXT_PUBLIC_SENTRY_DSN: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a real Sentry DSN (userinfo URL) — the prod build input", () => {
    const result = webEnvSchema.safeParse({
      NEXT_PUBLIC_SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
    });
    expect(result.success).toBe(true);
    expect(result.data?.NEXT_PUBLIC_SENTRY_DSN).toBe(
      "https://key@o0.ingest.sentry.io/0",
    );
  });

  it("carries no .default() — an absent field parses to undefined", () => {
    const result = webEnvSchema.safeParse({});
    expect(result.data?.NEXT_PUBLIC_AUTH_STUB).toBeUndefined();
    expect(result.data?.NEXT_PUBLIC_APP_VERSION).toBeUndefined();
  });
});

describe("assertWebEnv", () => {
  it("throws a descriptive error naming the offending variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "not-a-url");
    expect(() => assertWebEnv()).toThrow(/NEXT_PUBLIC_SENTRY_DSN/);
  });

  it("passes when every in-scope var is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", undefined);
    vi.stubEnv("NEXT_PUBLIC_DEV_ROLE_SWITCHER", undefined);
    vi.stubEnv("NEXT_PUBLIC_WEB_VITALS", undefined);
    expect(() => assertWebEnv()).not.toThrow();
  });

  it("passes on an empty-string DSN (docker dev supplies '')", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(() => assertWebEnv()).not.toThrow();
  });
});

describe("webEnv getters", () => {
  it("resolves a toggle to a boolean read lazily at call time", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_WEB_VITALS", "true");
    expect(webEnv.webVitals()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_WEB_VITALS", "false");
    expect(webEnv.webVitals()).toBe(false);
  });

  it("keeps product feedback disabled unless explicitly enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED", undefined);
    expect(webEnv.productFeedback()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED", "true");
    expect(webEnv.productFeedback()).toBe(true);
  });

  it("returns a fail-closed feedback inbox role allowlist", () => {
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES", undefined);
    expect(webEnv.productFeedbackInboxRoles()).toEqual([]);
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES", "admin,head");
    expect(webEnv.productFeedbackInboxRoles()).toEqual(["admin", "head"]);
  });

  it("treats an empty appVersion as unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "");
    expect(webEnv.appVersion()).toBeUndefined();
  });

  it("folds NODE_ENV into authStub — false in production even when true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", "true");
    expect(webEnv.authStub()).toBe(false);
  });

  it("authStub is true outside production when the toggle is true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", "true");
    expect(webEnv.authStub()).toBe(true);
  });

  it("folds NODE_ENV into devRoleSwitcher — false in production even when true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_ROLE_SWITCHER", "true");
    expect(webEnv.devRoleSwitcher()).toBe(false);
  });
});
