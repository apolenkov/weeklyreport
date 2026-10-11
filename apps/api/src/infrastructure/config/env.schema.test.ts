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
  GOTENBERG_URL: "http://gotenberg:3000",
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
    "GOTENBERG_URL",
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

  it("preserves the trimmed provider origin allowlist as a string", () => {
    const value = " https://api.mistral.ai, https://openrouter.ai ";
    expect(
      envSchema.parse({
        ...COMPLETE,
        [REPORT_ASSISTANT_ENV_KEYS.providerAllowedOrigins]: value,
      })[REPORT_ASSISTANT_ENV_KEYS.providerAllowedOrigins],
    ).toBe("https://api.mistral.ai, https://openrouter.ai");
  });

  it.each([
    "",
    " ".repeat(3),
    "not-a-url",
    "https://api.example.com/v1",
    "https://api.example.com,not-a-url",
  ])("rejects an invalid provider origin allowlist %j", (value) => {
    const result = envSchema.safeParse({
      ...COMPLETE,
      [REPORT_ASSISTANT_ENV_KEYS.providerAllowedOrigins]: value,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
        REPORT_ASSISTANT_ENV_KEYS.providerAllowedOrigins,
      ]);
    }
  });

  const BASE64_KEY =
    COMPLETE[REPORT_ASSISTANT_ENV_KEYS.providerConfigEncryptionKey];

  it.each([
    ["64-char lowercase hex", "a".repeat(64)],
    ["64-char uppercase hex", "A".repeat(64)],
    ["canonical padded base64", BASE64_KEY],
    ["outer-trimmed base64", `  ${BASE64_KEY}  `],
  ])("accepts %s encryption key material", (_label, value) => {
    expect(
      envSchema.safeParse({
        ...COMPLETE,
        [REPORT_ASSISTANT_ENV_KEYS.providerConfigEncryptionKey]: value,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["invalid character", `!${BASE64_KEY.slice(1)}`],
    [
      "interior whitespace",
      `${BASE64_KEY.slice(0, 20)} ${BASE64_KEY.slice(21)}`,
    ],
    ["missing padding", BASE64_KEY.slice(0, -1)],
    ["excess padding", `${BASE64_KEY}=`],
    ["base64 of 31 bytes", Buffer.alloc(31, 1).toString("base64")],
  ])(
    "rejects malformed encryption key material: %s without echoing it",
    (_label, value) => {
      const result = envSchema.safeParse({
        ...COMPLETE,
        [REPORT_ASSISTANT_ENV_KEYS.providerConfigEncryptionKey]: value,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.filter((issue) =>
          issue.path.includes(
            REPORT_ASSISTANT_ENV_KEYS.providerConfigEncryptionKey,
          ),
        );
        expect(issues.length).toBeGreaterThan(0);
        for (const issue of issues) {
          expect(issue.message).not.toContain(value.trim());
        }
      }
    },
  );

  describe.each([
    ["REDIS_DB", "15"],
    ["DB_POOL_IDLE_TIMEOUT_MS", "10000"],
    ["DB_POOL_CONNECTION_TIMEOUT_MS", "10000"],
    [REPORT_ASSISTANT_ENV_KEYS.similarityThreshold, "1"],
  ] as const)("explicit numeric configuration for %s", (key, validValue) => {
    it.each(["", " ".repeat(3), "\t\n"])("rejects blank value %j", (value) => {
      const result = envSchema.safeParse({ ...COMPLETE, [key]: value });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
          key,
        ]);
      }
    });

    it.each(["0", validValue])("accepts explicit value %s", (value) => {
      expect(envSchema.parse({ ...COMPLETE, [key]: value })[key]).toBe(
        Number(value),
      );
    });
  });

  describe.each(["PORT", "REDIS_PORT", "SMTP_PORT"] as const)(
    "TCP port range for %s",
    (key) => {
      it.each(["1", "65535"])("accepts boundary port %s", (value) => {
        expect(envSchema.parse({ ...COMPLETE, [key]: value })[key]).toBe(
          Number(value),
        );
      });

      it.each(["0", "65536", "999999", "1.5", "not-a-number", ""])(
        "rejects an out-of-range port %j",
        (value) => {
          const result = envSchema.safeParse({ ...COMPLETE, [key]: value });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(
              result.error.issues.map((issue) => issue.path),
            ).toContainEqual([key]);
          }
        },
      );
    },
  );

  it.each(["", " ".repeat(3), "\t\n"])(
    "rejects blank REDIS_HOST %j",
    (REDIS_HOST) => {
      expect(envSchema.safeParse({ ...COMPLETE, REDIS_HOST }).success).toBe(
        false,
      );
    },
  );

  it.each(["localhost", "redis", "127.0.0.1", "::1"])(
    "preserves nonblank REDIS_HOST %j",
    (REDIS_HOST) => {
      expect(envSchema.parse({ ...COMPLETE, REDIS_HOST }).REDIS_HOST).toBe(
        REDIS_HOST,
      );
    },
  );

  it.each(["", " ".repeat(3), "\t\n"])(
    "rejects blank PDF_OUTPUT_DIR %j",
    (PDF_OUTPUT_DIR) => {
      expect(envSchema.safeParse({ ...COMPLETE, PDF_OUTPUT_DIR }).success).toBe(
        false,
      );
    },
  );

  it.each(["./storage/pdfs", "/var/lib/customreport/pdfs", " ./pdfs "])(
    "preserves nonblank PDF_OUTPUT_DIR %j",
    (PDF_OUTPUT_DIR) => {
      expect(
        envSchema.parse({ ...COMPLETE, PDF_OUTPUT_DIR }).PDF_OUTPUT_DIR,
      ).toBe(PDF_OUTPUT_DIR);
    },
  );

  it.each(["localhost", "::", "", "api.example.com"] as const)(
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

  it.each(["not-a-url", "ftp://otel:4318", "http://"] as const)(
    "rejects a non-blank invalid OTEL endpoint %j",
    (OTEL_EXPORTER_OTLP_ENDPOINT) => {
      expect(
        envSchema.safeParse({
          ...COMPLETE,
          OTEL_EXPORTER_OTLP_ENDPOINT,
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    "http://otel:4318",
    "https://collector.example.com/otlp",
    " http://otel:4318 ",
  ] as const)(
    "accepts the OTEL endpoint %j shared with the early bootstrap",
    (OTEL_EXPORTER_OTLP_ENDPOINT) => {
      expect(
        envSchema.safeParse({
          ...COMPLETE,
          OTEL_EXPORTER_OTLP_ENDPOINT,
        }).success,
      ).toBe(true);
    },
  );

  it.each([
    "https://key@o123.ingest.sentry.io/456",
    "http://key@selfhosted.local:9000/7",
  ] as const)("accepts the valid SENTRY_DSN %j", (SENTRY_DSN) => {
    expect(envSchema.safeParse({ ...COMPLETE, SENTRY_DSN }).success).toBe(true);
  });

  it.each([
    " ".repeat(4),
    "not-a-dsn",
    "ftp://key@sentry.example.com/42",
    "https://sentry.example.com/42",
    "https://key@sentry.example.com/abc",
  ] as const)(
    "rejects the malformed configured SENTRY_DSN %j",
    (SENTRY_DSN) => {
      expect(envSchema.safeParse({ ...COMPLETE, SENTRY_DSN }).success).toBe(
        false,
      );
    },
  );

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

  describe.each([
    "DB_POOL_IDLE_TIMEOUT_MS",
    "DB_POOL_CONNECTION_TIMEOUT_MS",
  ] as const)("integer constraint for %s", (key) => {
    it.each(["1.5", "-1", "notnum"])("rejects malformed value %s", (value) => {
      expect(envSchema.safeParse({ ...COMPLETE, [key]: value }).success).toBe(
        false,
      );
    });
  });

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

  it.each(["https://App.example.com/", "https://app.example.com:443"])(
    "accepts FRONTEND_URL %j canonicalizing to the configured origin",
    (FRONTEND_URL) => {
      expect(envSchema.safeParse({ ...COMPLETE, FRONTEND_URL }).success).toBe(
        true,
      );
    },
  );

  it.each([
    "ftp://app.example.com",
    "file:///etc/hostname",
    "https://user:pass@app.example.com",
  ])(
    "rejects a non-HTTP(S) or credentialed FRONTEND_URL %j",
    (FRONTEND_URL) => {
      expect(envSchema.safeParse({ ...COMPLETE, FRONTEND_URL }).success).toBe(
        false,
      );
    },
  );

  it.each([
    "not-a-url",
    "ftp://files.example.com",
    "https://user:pass@app.example.com",
    "https://a.example.com,*",
    "https://*.example.com",
    "https://app.example.com,not-a-url",
  ])(
    "rejects malformed FRONTEND_URLS entry %j in every environment",
    (FRONTEND_URLS) => {
      expect(
        envSchema.safeParse({
          ...COMPLETE,
          NODE_ENV: "development",
          FRONTEND_URLS,
        }).success,
      ).toBe(false);
    },
  );

  it("accepts FRONTEND_URLS entries that canonicalize to HTTP(S) origins", () => {
    expect(
      envSchema.safeParse({
        ...COMPLETE,
        FRONTEND_URLS:
          " https://Admin.example.com/ , https://app.example.com:443 ",
      }).success,
    ).toBe(true);
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
  it.each(["AUTH_JWT_SECRET", "PDF_EXPORT_JWT_SECRET"])(
    "rejects a placeholder %s in production",
    (key) => {
      expect(
        envSchema.safeParse({
          ...COMPLETE,
          [key]: "change-me-in-production-min-32-chars!!",
        }).success,
      ).toBe(false);
    },
  );

  it.each(["AUTH_JWT_SECRET", "PDF_EXPORT_JWT_SECRET"])(
    "rejects a whitespace-padded placeholder %s in production",
    (key) => {
      expect(
        envSchema.safeParse({
          ...COMPLETE,
          [key]: "  change-me-in-production-min-32-chars!!  ",
        }).success,
      ).toBe(false);
    },
  );

  it.each(["AUTH_JWT_SECRET", "PDF_EXPORT_JWT_SECRET"])(
    "rejects whitespace-only or meaningfully short %s",
    (key) => {
      for (const secret of [" ".repeat(32), ` ${"a".repeat(31)} `]) {
        expect(
          envSchema.safeParse({ ...COMPLETE, [key]: secret }).success,
        ).toBe(false);
      }
    },
  );

  it.each(["AUTH_JWT_SECRET", "PDF_EXPORT_JWT_SECRET"] as const)(
    "accepts a padded %s whose meaningful length meets the floor",
    (key) => {
      const result = envSchema.safeParse({
        ...COMPLETE,
        [key]: `  ${"k".repeat(32)}  `,
      });
      expect(result.success).toBe(true);
      // The accepted value is preserved byte-for-byte for the JWT signer.
      if (result.success)
        expect(result.data[key]).toBe(`  ${"k".repeat(32)}  `);
    },
  );

  it.each([
    ["OTEL_SDK_DISABLED", "1"],
    ["CLIENT_LOG_FORWARDING", "TRUE"],
    ["AUTH_DEV_MODE_ALLOW_TEST", "yes"],
  ])("rejects malformed boolean flag %s=%s", (key, value) => {
    expect(envSchema.safeParse({ ...COMPLETE, [key]: value }).success).toBe(
      false,
    );
  });

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

  it.each([
    [{ SMTP_USER: "mailer" }, "SMTP_PASS"],
    [{ SMTP_PASS: "s3cret" }, "SMTP_USER"],
    [{ SMTP_USER: "mailer", SMTP_PASS: " ".repeat(3) }, "SMTP_PASS"],
  ])(
    "rejects a half-configured SMTP auth pair %o (issue on %s)",
    (extra, issuePath) => {
      const result = envSchema.safeParse({ ...COMPLETE, ...extra });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === issuePath &&
            issue.message.includes("SMTP_USER and SMTP_PASS"),
        ),
      ).toBe(true);
    },
  );

  it.each([
    {},
    { SMTP_USER: "mailer", SMTP_PASS: "s3cret" },
    { SMTP_USER: " ".repeat(3), SMTP_PASS: "" },
  ])("accepts a complete or fully absent SMTP auth pair %o", (extra) => {
    expect(envSchema.safeParse({ ...COMPLETE, ...extra }).success).toBe(true);
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
