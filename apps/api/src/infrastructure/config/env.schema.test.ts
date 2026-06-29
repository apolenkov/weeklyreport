import { describe, expect, it } from "vitest";

import { envSchema } from "./env.schema";

// A minimal env that satisfies every unconditionally-required field, so each
// test can flip exactly one knob and attribute the pass/fail to it.
const PROD_BASE = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  AUTH_JWT_SECRET: "a-production-secret-at-least-32-chars",
  PDF_EXPORT_JWT_SECRET: "a-production-pdf-secret-at-least-32-chars",
  FRONTEND_URL: "https://app.example.com",
} as const;

describe("envSchema — required secrets", () => {
  it("rejects a config with no AUTH_JWT_SECRET", () => {
    const { AUTH_JWT_SECRET: _omit, ...withoutSecret } = PROD_BASE;
    const result = envSchema.safeParse(withoutSecret);
    expect(result.success).toBe(false);
  });

  it("rejects an AUTH_JWT_SECRET shorter than 32 chars", () => {
    const result = envSchema.safeParse({
      ...PROD_BASE,
      AUTH_JWT_SECRET: "too-short",
    });
    expect(result.success).toBe(false);
  });

  it("requires the secret even in dev mode (signer is built at boot)", () => {
    const { AUTH_JWT_SECRET: _omit, ...withoutSecret } = PROD_BASE;
    const result = envSchema.safeParse({
      ...withoutSecret,
      NODE_ENV: "development",
      AUTH_DEV_MODE: "true",
    });
    expect(result.success).toBe(false);
  });
});

describe("envSchema — FRONTEND_URL production fence", () => {
  it("rejects the localhost dev default in production", () => {
    const result = envSchema.safeParse({
      ...PROD_BASE,
      FRONTEND_URL: "http://localhost:3000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes("FRONTEND_URL")),
      ).toBe(true);
    }
  });

  it("accepts an overridden FRONTEND_URL in production", () => {
    const result = envSchema.safeParse(PROD_BASE);
    expect(result.success).toBe(true);
  });

  it("allows the localhost default outside production", () => {
    const result = envSchema.safeParse({
      ...PROD_BASE,
      NODE_ENV: "development",
      FRONTEND_URL: "http://localhost:3000",
    });
    expect(result.success).toBe(true);
  });
});
