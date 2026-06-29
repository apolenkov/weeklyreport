import { describe, expect, it } from "vitest";

import { envSchema } from "./env.schema";

// A complete env that satisfies every required field, so each test can flip or
// omit exactly one knob and attribute the pass/fail to it. The schema has no
// defaults: every key here is mandatory for a successful parse.
const COMPLETE = {
  NODE_ENV: "production",
  PORT: "3001",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  FRONTEND_URL: "https://app.example.com",
  APP_BASE_URL: "https://app.example.com",
  AUTH_DEV_MODE: "false",
  LOG_LEVEL: "info",
  AUTH_JWT_SECRET: "a-production-secret-at-least-32-chars",
  REDIS_HOST: "localhost",
  REDIS_PORT: "6379",
  OTEL_SDK_DISABLED: "false",
  OTEL_TRACES_SAMPLER_ARG: "0.1",
  PDF_BASE_URL: "https://app.example.com",
  PDF_OUTPUT_DIR: "/var/lib/customreport/pdfs",
  PDF_EXPORT_JWT_SECRET: "a-production-pdf-secret-at-least-32-chars",
} as const;

describe("envSchema — no defaults, every product var required", () => {
  it("accepts a complete config", () => {
    expect(envSchema.safeParse(COMPLETE).success).toBe(true);
  });

  // Each required key, omitted in turn, must fail the parse — proving the
  // schema carries no silent default that would let a missing var slip through.
  it.each([
    "PORT",
    "NODE_ENV",
    "FRONTEND_URL",
    "APP_BASE_URL",
    "AUTH_DEV_MODE",
    "LOG_LEVEL",
    "AUTH_JWT_SECRET",
    "REDIS_HOST",
    "REDIS_PORT",
    "OTEL_SDK_DISABLED",
    "OTEL_TRACES_SAMPLER_ARG",
    "PDF_BASE_URL",
    "PDF_OUTPUT_DIR",
    "PDF_EXPORT_JWT_SECRET",
  ] as const)("rejects a config missing %s", (key) => {
    const { [key]: _omit, ...without } = COMPLETE;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it("rejects an AUTH_JWT_SECRET shorter than 32 chars", () => {
    expect(
      envSchema.safeParse({ ...COMPLETE, AUTH_JWT_SECRET: "too-short" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-URL FRONTEND_URL / APP_BASE_URL", () => {
    expect(
      envSchema.safeParse({ ...COMPLETE, APP_BASE_URL: "not-a-url" }).success,
    ).toBe(false);
  });
});

describe("envSchema — production fences", () => {
  it("forbids AUTH_DEV_MODE=true in production", () => {
    const result = envSchema.safeParse({ ...COMPLETE, AUTH_DEV_MODE: "true" });
    expect(result.success).toBe(false);
  });

  it("allows AUTH_DEV_MODE=true outside production", () => {
    const result = envSchema.safeParse({
      ...COMPLETE,
      NODE_ENV: "development",
      AUTH_DEV_MODE: "true",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a wildcard in FRONTEND_URLS in production", () => {
    const result = envSchema.safeParse({
      ...COMPLETE,
      FRONTEND_URLS: "https://a.example.com,*",
    });
    expect(result.success).toBe(false);
  });
});
