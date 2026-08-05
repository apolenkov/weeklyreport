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
  REDIS_MAXMEMORY_BYTES: "209715200",
  OTEL_SDK_DISABLED: "false",
  OTEL_TRACES_SAMPLER_ARG: "0.1",
  PDF_BASE_URL: "https://app.example.com",
  PDF_OUTPUT_DIR: "/var/lib/customreport/pdfs",
  PDF_EXPORT_JWT_SECRET: "a-production-pdf-secret-at-least-32-chars",
  SMTP_HOST: "smtp.example.com",
  SMTP_FROM: "noreply@example.com",
  KEYCLOAK_SAML_CALLBACK_URL: "https://app.example.com/auth/saml/callback",
  KEYCLOAK_SAML_ENTRY_POINT: "https://idp.example.com/saml/sso",
  KEYCLOAK_SAML_ISSUER: "customreport",
  KEYCLOAK_SAML_CERT: "MIIC-fake-cert-material",
  HEAP_HEALTH_THRESHOLD_BYTES: "1610612736",
  MISTRAL_API_KEY: "test-only-placeholder",
  MISTRAL_PLANNER_MODEL: "mistral-medium-3-5",
  MISTRAL_ANSWER_MODEL: "mistral-medium-3-5",
  MISTRAL_EMBEDDING_MODEL: "mistral-embed",
  MISTRAL_EMBEDDING_DIMENSIONS: "1024",
  MISTRAL_API_SERVER: "eu",
  REPORT_ASSISTANT_INPUT_VERSION: "1",
  REPORT_ASSISTANT_SIMILARITY_THRESHOLD: "0.55",
  REPORT_ASSISTANT_CANDIDATE_LIMIT: "500",
  REPORT_ASSISTANT_READ_THROUGH_LIMIT: "16",
  REPORT_ASSISTANT_EXHAUSTIVE_LIMIT: "200",
  REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET: "8000",
  REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS: "30000",
  REPORT_ASSISTANT_PLANNER_MAX_TOKENS: "1500",
  REPORT_ASSISTANT_ANSWER_MAX_TOKENS: "2000",
  REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE: "32",
  REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET: "8000",
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
    "REDIS_MAXMEMORY_BYTES",
    "OTEL_SDK_DISABLED",
    "OTEL_TRACES_SAMPLER_ARG",
    "PDF_BASE_URL",
    "PDF_OUTPUT_DIR",
    "PDF_EXPORT_JWT_SECRET",
    "HEAP_HEALTH_THRESHOLD_BYTES",
    "MISTRAL_API_KEY",
    "MISTRAL_PLANNER_MODEL",
    "MISTRAL_ANSWER_MODEL",
    "MISTRAL_EMBEDDING_MODEL",
    "MISTRAL_EMBEDDING_DIMENSIONS",
    "MISTRAL_API_SERVER",
    "REPORT_ASSISTANT_INPUT_VERSION",
    "REPORT_ASSISTANT_SIMILARITY_THRESHOLD",
    "REPORT_ASSISTANT_CANDIDATE_LIMIT",
    "REPORT_ASSISTANT_READ_THROUGH_LIMIT",
    "REPORT_ASSISTANT_EXHAUSTIVE_LIMIT",
    "REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET",
    "REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS",
    "REPORT_ASSISTANT_PLANNER_MAX_TOKENS",
    "REPORT_ASSISTANT_ANSWER_MAX_TOKENS",
    "REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE",
    "REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET",
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

  it("rejects a PDF_EXPORT_JWT_SECRET shorter than 32 chars", () => {
    // 17 chars: clears the old 16-char floor, fails the raised 32-char one.
    expect(
      envSchema.safeParse({
        ...COMPLETE,
        PDF_EXPORT_JWT_SECRET: "seventeen-chars-x",
      }).success,
    ).toBe(false);
  });

  it.each(["0", "-1", "1.5", "not-a-number"] as const)(
    "rejects a non-positive-integer HEAP_HEALTH_THRESHOLD_BYTES (%s)",
    (value) => {
      expect(
        envSchema.safeParse({
          ...COMPLETE,
          HEAP_HEALTH_THRESHOLD_BYTES: value,
        }).success,
      ).toBe(false);
    },
  );

  it.each(["0", "-1", "1.5", "not-a-number"] as const)(
    "rejects a non-positive-integer REDIS_MAXMEMORY_BYTES (%s)",
    (value) => {
      expect(
        envSchema.safeParse({
          ...COMPLETE,
          REDIS_MAXMEMORY_BYTES: value,
        }).success,
      ).toBe(false);
    },
  );

  // DB_POOL_* are genuinely optional (absent → PrismaService applies its own
  // named defaults), so an omitted value must still parse — but a PRESENT
  // malformed value must fail boot rather than reach pg.
  it("accepts a config with the DB_POOL_* vars absent", () => {
    expect(envSchema.safeParse(COMPLETE).success).toBe(true);
  });

  it.each(["10junk", "1.5", "0", "-1", ""] as const)(
    "rejects a malformed DB_POOL_MAX (%s)",
    (value) => {
      expect(
        envSchema.safeParse({ ...COMPLETE, DB_POOL_MAX: value }).success,
      ).toBe(false);
    },
  );

  it.each(["1.5", "-1", "notnum"] as const)(
    "rejects a malformed DB_POOL_IDLE_TIMEOUT_MS (%s)",
    (value) => {
      expect(
        envSchema.safeParse({ ...COMPLETE, DB_POOL_IDLE_TIMEOUT_MS: value })
          .success,
      ).toBe(false);
    },
  );

  it("accepts a zero timeout but rejects a zero DB_POOL_MAX", () => {
    expect(
      envSchema.safeParse({
        ...COMPLETE,
        DB_POOL_CONNECTION_TIMEOUT_MS: "0",
      }).success,
    ).toBe(true);
    expect(envSchema.safeParse({ ...COMPLETE, DB_POOL_MAX: "0" }).success).toBe(
      false,
    );
  });

  it("rejects a non-URL FRONTEND_URL / APP_BASE_URL", () => {
    expect(
      envSchema.safeParse({ ...COMPLETE, APP_BASE_URL: "not-a-url" }).success,
    ).toBe(false);
  });

  it.each(["0", "-1", "1.5", "not-a-number"] as const)(
    "rejects invalid assistant integer limits (%s)",
    (value) => {
      expect(
        envSchema.safeParse({
          ...COMPLETE,
          REPORT_ASSISTANT_CANDIDATE_LIMIT: value,
        }).success,
      ).toBe(false);
    },
  );

  it.each(["-0.1", "1.1", "not-a-number"] as const)(
    "rejects an invalid assistant similarity threshold (%s)",
    (value) => {
      expect(
        envSchema.safeParse({
          ...COMPLETE,
          REPORT_ASSISTANT_SIMILARITY_THRESHOLD: value,
        }).success,
      ).toBe(false);
    },
  );
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

  it("requires SMTP_HOST in production", () => {
    const { SMTP_HOST: _omit, ...without } = COMPLETE;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it("requires SMTP_FROM in production", () => {
    const { SMTP_FROM: _omit, ...without } = COMPLETE;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it("rejects whitespace-only SMTP_HOST/SMTP_FROM in production", () => {
    const result = envSchema.safeParse({
      ...COMPLETE,
      SMTP_HOST: " ".repeat(3),
      SMTP_FROM: " ".repeat(3),
    });
    expect(result.success).toBe(false);
  });

  it("accepts production with both SMTP_HOST and SMTP_FROM set", () => {
    expect(envSchema.safeParse(COMPLETE).success).toBe(true);
  });

  it("allows absent SMTP_HOST/SMTP_FROM outside production", () => {
    const { SMTP_HOST: _host, SMTP_FROM: _from, ...without } = COMPLETE;
    const result = envSchema.safeParse({
      ...without,
      NODE_ENV: "development",
    });
    expect(result.success).toBe(true);
  });

  // SAML config is required in production once dev-login is off, mirroring the
  // SMTP fence. The four vars stay optional in the object shape so dev-login
  // boots without an IdP; the fence lives entirely in superRefine.
  it.each([
    "KEYCLOAK_SAML_CALLBACK_URL",
    "KEYCLOAK_SAML_ENTRY_POINT",
    "KEYCLOAK_SAML_ISSUER",
    "KEYCLOAK_SAML_CERT",
  ] as const)("requires %s in production when AUTH_DEV_MODE=false", (key) => {
    const { [key]: _omit, ...without } = COMPLETE;
    const result = envSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it("names the missing SAML var in the production issue path", () => {
    const { KEYCLOAK_SAML_ISSUER: _omit, ...without } = COMPLETE;
    const result = envSchema.safeParse(without);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("KEYCLOAK_SAML_ISSUER");
    }
  });

  it("rejects whitespace-only SAML vars in production", () => {
    const result = envSchema.safeParse({
      ...COMPLETE,
      KEYCLOAK_SAML_ISSUER: " ".repeat(3),
    });
    expect(result.success).toBe(false);
  });

  it("accepts production with all four SAML vars set", () => {
    expect(envSchema.safeParse(COMPLETE).success).toBe(true);
  });

  it("allows absent SAML vars outside production", () => {
    const {
      KEYCLOAK_SAML_CALLBACK_URL: _cb,
      KEYCLOAK_SAML_ENTRY_POINT: _ep,
      KEYCLOAK_SAML_ISSUER: _iss,
      KEYCLOAK_SAML_CERT: _cert,
      ...without
    } = COMPLETE;
    const result = envSchema.safeParse({
      ...without,
      NODE_ENV: "development",
    });
    expect(result.success).toBe(true);
  });
});
