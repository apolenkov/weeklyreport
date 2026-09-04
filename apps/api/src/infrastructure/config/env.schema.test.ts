import { describe, expect, it } from "vitest";

import { envSchema } from "./env.schema";
import {
  REPORT_ASSISTANT_ENV_KEYS,
  REQUIRED_REPORT_ASSISTANT_ENV_KEYS,
} from "./report-assistant-env-keys";

// A complete env that satisfies every required field, so each test can flip or
// omit exactly one knob and attribute the pass/fail to it. The schema has no
// defaults: every key here is mandatory for a successful parse.
const COMPLETE = {
  NODE_ENV: "production",
  PORT: "3001",
  API_HOST: "0.0.0.0",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  FRONTEND_URL: "https://app.example.com",
  APP_BASE_URL: "https://app.example.com",
  AUTH_DEV_MODE: "false",
  LOG_LEVEL: "info",
  AUTH_JWT_SECRET: "a-production-secret-at-least-32-chars",
  REDIS_HOST: "localhost",
  REDIS_PORT: "6379",
  REDIS_DB: "0",
  REDIS_MAXMEMORY_BYTES: "209715200",
  OTEL_SDK_DISABLED: "false",
  OTEL_TRACES_SAMPLER_ARG: "0.1",
  PDF_BASE_URL: "https://app.example.com",
  PDF_OUTPUT_DIR: "/var/lib/customreport/pdfs",
  PDF_EXPORT_JWT_SECRET: "a-production-pdf-secret-at-least-32-chars",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_FROM: "noreply@example.com",
  KEYCLOAK_SAML_CALLBACK_URL: "https://app.example.com/auth/saml/callback",
  KEYCLOAK_SAML_ENTRY_POINT: "https://idp.example.com/saml/sso",
  KEYCLOAK_SAML_ISSUER: "customreport",
  KEYCLOAK_SAML_CERT: "MIIC-fake-cert-material",
  HEAP_HEALTH_THRESHOLD_BYTES: "1610612736",
  DB_POOL_MAX: "10",
  DB_POOL_IDLE_TIMEOUT_MS: "10000",
  DB_POOL_CONNECTION_TIMEOUT_MS: "0",
  OTEL_SERVICE_VERSION: "84221c6d",
  [REPORT_ASSISTANT_ENV_KEYS.providerConfigEncryptionKey]:
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  [REPORT_ASSISTANT_ENV_KEYS.providerConfigKeyVersion]: "1",
  [REPORT_ASSISTANT_ENV_KEYS.providerAllowedOrigins]:
    "https://api.mistral.ai,https://openrouter.ai,https://api.groq.com,https://api.jina.ai,https://api.openai.com",
  [REPORT_ASSISTANT_ENV_KEYS.outboundDataApproved]: "false",
  [REPORT_ASSISTANT_ENV_KEYS.inputVersion]: "1",
  [REPORT_ASSISTANT_ENV_KEYS.similarityThreshold]: "0.55",
  [REPORT_ASSISTANT_ENV_KEYS.candidateLimit]: "500",
  [REPORT_ASSISTANT_ENV_KEYS.readThroughLimit]: "16",
  [REPORT_ASSISTANT_ENV_KEYS.exhaustiveLimit]: "200",
  [REPORT_ASSISTANT_ENV_KEYS.contextTokenBudget]: "8000",
  [REPORT_ASSISTANT_ENV_KEYS.providerTimeoutMs]: "30000",
  [REPORT_ASSISTANT_ENV_KEYS.plannerMaxTokens]: "1500",
  [REPORT_ASSISTANT_ENV_KEYS.answerMaxTokens]: "2000",
  [REPORT_ASSISTANT_ENV_KEYS.embeddingBatchSize]: "32",
  [REPORT_ASSISTANT_ENV_KEYS.embeddingTokenBudget]: "8000",
} as const;

describe("envSchema — no defaults, every product var required", () => {
  it("accepts a complete config", () => {
    expect(envSchema.safeParse(COMPLETE).success).toBe(true);
  });

  it("validates product feedback as an optional fail-closed toggle", () => {
    const absent = envSchema.parse(COMPLETE);
    expect(absent.PRODUCT_FEEDBACK_ENABLED).toBeUndefined();
    expect(
      envSchema.parse({ ...COMPLETE, PRODUCT_FEEDBACK_ENABLED: "true" })
        .PRODUCT_FEEDBACK_ENABLED,
    ).toBe(true);
    expect(
      envSchema.safeParse({
        ...COMPLETE,
        PRODUCT_FEEDBACK_ENABLED: "enabled",
      }).success,
    ).toBe(false);
  });

  it("accepts an optional non-blank Agentation MCP key", () => {
    expect(envSchema.parse(COMPLETE).AGENTATION_API_KEY).toBeUndefined();
    const key = "local-agentation-key-at-least-32-characters";
    expect(
      envSchema.parse({ ...COMPLETE, AGENTATION_API_KEY: key })
        .AGENTATION_API_KEY,
    ).toBe(key);
    expect(
      envSchema.safeParse({ ...COMPLETE, AGENTATION_API_KEY: " " }).success,
    ).toBe(false);
  });

  // Each required key, omitted in turn, must fail the parse — proving the
  // schema carries no silent default that would let a missing var slip through.
  it.each([
    "DATABASE_URL",
    "PORT",
    "API_HOST",
    "NODE_ENV",
    "FRONTEND_URL",
    "APP_BASE_URL",
    "AUTH_DEV_MODE",
    "LOG_LEVEL",
    "AUTH_JWT_SECRET",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_DB",
    "REDIS_MAXMEMORY_BYTES",
    "OTEL_SDK_DISABLED",
    "OTEL_TRACES_SAMPLER_ARG",
    "PDF_BASE_URL",
    "PDF_OUTPUT_DIR",
    "PDF_EXPORT_JWT_SECRET",
    "HEAP_HEALTH_THRESHOLD_BYTES",
    ...REQUIRED_REPORT_ASSISTANT_ENV_KEYS,
  ] as const)("rejects a config missing %s", (key) => {
    const { [key]: _omit, ...without } = COMPLETE;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it.each(["-1", "16", "1.5", "not-a-number"] as const)(
    "rejects an invalid REDIS_DB (%s)",
    (value) => {
      expect(
        envSchema.safeParse({ ...COMPLETE, REDIS_DB: value }).success,
      ).toBe(false);
    },
  );

  it.each(["localhost", "::", "", "api.internal"] as const)(
    "rejects an unsupported API_HOST (%j)",
    (API_HOST) => {
      expect(envSchema.safeParse({ ...COMPLETE, API_HOST }).success).toBe(
        false,
      );
    },
  );

  it("rejects an AUTH_JWT_SECRET shorter than 32 chars", () => {
    expect(
      envSchema.safeParse({ ...COMPLETE, AUTH_JWT_SECRET: "too-short" })
        .success,
    ).toBe(false);
  });

  it("rejects a PDF_EXPORT_JWT_SECRET shorter than 32 chars", () => {
    // Below the 32-char minimum.
    expect(
      envSchema.safeParse({
        ...COMPLETE,
        PDF_EXPORT_JWT_SECRET: "seventeen-chars-x",
      }).success,
    ).toBe(false);
  });

  it.each(["", " ".repeat(3)] as const)(
    "rejects a blank OTEL_TRACES_SAMPLER_ARG (%j)",
    (value) => {
      expect(
        envSchema.safeParse({ ...COMPLETE, OTEL_TRACES_SAMPLER_ARG: value })
          .success,
      ).toBe(false);
    },
  );

  it.each(["", " ".repeat(3)] as const)(
    "treats a blank optional OTEL endpoint as absent (%j)",
    (OTEL_EXPORTER_OTLP_ENDPOINT) => {
      const result = envSchema.safeParse({
        ...COMPLETE,
        OTEL_EXPORTER_OTLP_ENDPOINT,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
      }
    },
  );

  it("rejects a non-blank invalid OTEL endpoint", () => {
    expect(
      envSchema.safeParse({
        ...COMPLETE,
        OTEL_EXPORTER_OTLP_ENDPOINT: "not-a-url",
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

  it("accepts an omitted DLQ_ALERT_THRESHOLD", () => {
    expect(envSchema.safeParse(COMPLETE).success).toBe(true);
  });

  it.each(["0", "-1", "1.5", "not-a-number"] as const)(
    "rejects a malformed DLQ_ALERT_THRESHOLD (%s)",
    (value) => {
      expect(
        envSchema.safeParse({ ...COMPLETE, DLQ_ALERT_THRESHOLD: value })
          .success,
      ).toBe(false);
    },
  );

  it("rejects a config with the DB_POOL_* vars absent", () => {
    const {
      DB_POOL_MAX: _max,
      DB_POOL_IDLE_TIMEOUT_MS: _idle,
      DB_POOL_CONNECTION_TIMEOUT_MS: _connection,
      ...without
    } = COMPLETE;
    expect(envSchema.safeParse(without).success).toBe(false);
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

  it.each(["TRUE", "ture", "1", ""] as const)(
    "rejects invalid AUTH_DEV_MODE value %j",
    (AUTH_DEV_MODE) => {
      expect(envSchema.safeParse({ ...COMPLETE, AUTH_DEV_MODE }).success).toBe(
        false,
      );
    },
  );

  it.each(["https://a.example.com,*", "https://*.example.com"] as const)(
    "rejects wildcard FRONTEND_URLS shape %s in production",
    (FRONTEND_URLS) => {
      const result = envSchema.safeParse({
        ...COMPLETE,
        FRONTEND_URLS,
      });
      expect(result.success).toBe(false);
    },
  );

  it("requires SMTP_HOST in production", () => {
    const { SMTP_HOST: _omit, ...without } = COMPLETE;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it("requires SMTP_FROM in production", () => {
    const { SMTP_FROM: _omit, ...without } = COMPLETE;
    expect(envSchema.safeParse(without).success).toBe(false);
  });

  it("requires SMTP_PORT in production", () => {
    const { SMTP_PORT: _omit, ...without } = COMPLETE;
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

  it("accepts production with SMTP host, port, and sender set", () => {
    expect(envSchema.safeParse(COMPLETE).success).toBe(true);
  });

  it("allows absent SMTP_HOST/SMTP_PORT/SMTP_FROM outside production", () => {
    const {
      SMTP_HOST: _host,
      SMTP_PORT: _port,
      SMTP_FROM: _from,
      ...without
    } = COMPLETE;
    const result = envSchema.safeParse({
      ...without,
      NODE_ENV: "development",
    });
    expect(result.success).toBe(true);
  });

  it("requires a non-blank release version in production", () => {
    const { OTEL_SERVICE_VERSION: _omit, ...without } = COMPLETE;
    expect(envSchema.safeParse(without).success).toBe(false);
    expect(
      envSchema.safeParse({
        ...COMPLETE,
        OTEL_SERVICE_VERSION: " ".repeat(3),
      }).success,
    ).toBe(false);
  });

  it("allows the release version to be absent outside production", () => {
    const { OTEL_SERVICE_VERSION: _omit, ...without } = COMPLETE;
    expect(
      envSchema.safeParse({ ...without, NODE_ENV: "development" }).success,
    ).toBe(true);
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
