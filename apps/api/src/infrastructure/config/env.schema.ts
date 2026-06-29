import { z } from "zod";

// No `.default()` anywhere in this schema by design: every value the API needs
// to run is REQUIRED and must be supplied explicitly per environment (`.env`
// for local, the `environment:` block per docker-compose file, the e2e config's
// webServer env). A silent default hides whether a value is mandatory and lets
// a misconfigured deploy boot with a wrong (e.g. localhost) value. Boot fails
// loud on a missing var instead. Genuinely-optional features stay `.optional()`
// (they have no default — the consumer handles absence).
export const envSchema = z
  .object({
    DATABASE_URL: z.url().startsWith("postgresql://"),
    DIRECT_URL: z.url().startsWith("postgresql://").optional(),
    PORT: z.coerce.number().int().positive(),
    NODE_ENV: z.enum(["development", "production", "test"]),
    FRONTEND_URL: z.url(),
    // Base URL the reminder scheduler embeds in notification email links
    // (`reminders.scheduler.ts`). Required so prod emails never link to
    // localhost; in dev/compose it is set to the same web origin as FRONTEND_URL.
    APP_BASE_URL: z.url(),
    // 36-04: optional CSV of additional allowed origins for CORS. Lets
    // prod accept e.g. customreport.example.com + admin.customreport.
    // example.com from the same API instance. Wildcards (*) are rejected
    // in superRefine when NODE_ENV=production.
    FRONTEND_URLS: z.string().optional(),
    AUTH_DEV_MODE: z.string().transform((v) => v === "true"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
    LOG_DIR: z.string().optional(),

    // Auth / JWT. Required (min 32): the JWT signer
    // (`auth.controller.ts::createJwtSigner`) is built at boot in EVERY mode —
    // dev-login still issues a session JWT — so a config without it crashes at
    // controller construction regardless of AUTH_DEV_MODE.
    AUTH_JWT_SECRET: z.string().min(32),

    // SAML / Keycloak (validated at runtime by saml.strategy.ts requireEnv).
    // Optional here because dev-login (AUTH_DEV_MODE) needs no IdP; prod boots
    // SAML and requireEnv enforces these.
    KEYCLOAK_SAML_CALLBACK_URL: z.url().optional(),
    KEYCLOAK_SAML_ENTRY_POINT: z.url().optional(),
    KEYCLOAK_SAML_ISSUER: z.string().optional(),
    KEYCLOAK_SAML_CERT: z.string().optional(),

    // Redis (BullMQ)
    REDIS_HOST: z.string(),
    REDIS_PORT: z.coerce.number().int().positive(),
    BULLMQ_PREFIX: z.string().optional(),

    // SMTP (email reminders)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),

    // OpenTelemetry (37-01). The endpoint stays optional — the SDK only starts
    // when OTEL_EXPORTER_OTLP_ENDPOINT is set AND OTEL_SDK_DISABLED is not
    // 'true'. The toggle + sampler are required so the telemetry posture is
    // always explicit. See otel.bootstrap.ts.
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_SDK_DISABLED: z.string(),
    OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1),
    OTEL_SERVICE_NAME: z.string().optional(),
    OTEL_SERVICE_VERSION: z.string().optional(),

    // PDF generation
    PDF_BASE_URL: z.url(),
    // Phase 23-01: directory where the BullMQ worker writes generated PDFs and
    // where /pdfs static mount serves them. Resolved relative to the API's cwd
    // (apps/api/) at runtime — `./storage/pdfs` lands at `apps/api/storage/pdfs`.
    PDF_OUTPUT_DIR: z.string(),
    // CC-1 (Phase 28-02): short-lived JWT signed at /trpc entry and injected
    // as cookie into the headless browser so PDF rendering can authenticate
    // against /weekly-report/* routes. Min 16 chars enforced in the service.
    PDF_EXPORT_JWT_SECRET: z.string().min(16),
  })
  .superRefine((data, ctx) => {
    // 36-03: production fences. Boot must fail if any of these aren't met.
    if (data.NODE_ENV === "production") {
      if (data.AUTH_DEV_MODE) {
        ctx.addIssue({
          code: "custom",
          message: "AUTH_DEV_MODE=true is forbidden when NODE_ENV=production",
          path: ["AUTH_DEV_MODE"],
        });
      }
      // FRONTEND_URLS (if set) must not include a wildcard. Wildcards are
      // a security smell in production CORS — caller could spoof origin
      // and bypass cookie SameSite= protections.
      if (data.FRONTEND_URLS) {
        const origins = data.FRONTEND_URLS.split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (origins.includes("*")) {
          ctx.addIssue({
            code: "custom",
            message: 'FRONTEND_URLS must not include "*" in production',
            path: ["FRONTEND_URLS"],
          });
        }
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(z.treeifyError(result.error));
    process.exit(1);
  }

  return result.data;
}
