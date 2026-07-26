import { z } from "zod";

import { logLevelSchema } from "../../lib/logger.js";

const MIN_JWT_SECRET_LENGTH = 32;

// No `.default()` anywhere by design: every value is REQUIRED and supplied
// explicitly per environment, so a misconfigured deploy fails boot loud instead
// of running on a silent (e.g. localhost) default. See env-schema-coverage spec.
const envObjectSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgresql://"),
  DIRECT_URL: z.url().startsWith("postgresql://").optional(),
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(["development", "production", "test"]),
  FRONTEND_URL: z.url(),
  // Base URL the reminder scheduler embeds in notification email links
  // (`reminders.scheduler.ts`). Required so prod emails never link to
  // localhost; in dev/compose it is set to the same web origin as FRONTEND_URL.
  APP_BASE_URL: z.url(),
  // Optional CSV of additional allowed origins for CORS. Lets
  // prod accept e.g. customreport.example.com + admin.customreport.
  // example.com from the same API instance. Wildcards (*) are rejected
  // in superRefine when NODE_ENV=production.
  FRONTEND_URLS: z.string().optional(),
  AUTH_DEV_MODE: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  // Non-prod test-context toggle, read raw beside NODE_ENV/AUTH_DEV_MODE in
  // the trpc.context dev-mode gate. Optional: only honoured when
  // NODE_ENV !== 'production'; absent → the test-context path stays off.
  AUTH_DEV_MODE_ALLOW_TEST: z.string().optional(),
  // Dev/test reseed repo-root override (`dev.wipeAndReseed`); first candidate
  // in a fallback list, so absent → the process walks cwd/workspace guesses.
  CUSTOMREPORT_REPO_ROOT: z.string().optional(),
  LOG_LEVEL: logLevelSchema,
  LOG_DIR: z.string().optional(),

  // Auth / JWT. Required (min 32): the JWT signer
  // (`auth.controller.ts::createJwtSigner`) is built at boot in EVERY mode —
  // dev-login still issues a session JWT — so a config without it crashes at
  // controller construction regardless of AUTH_DEV_MODE.
  AUTH_JWT_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH),
  // Session-cookie name. Optional: `resolveSessionCookieName` applies its
  // named SESSION_COOKIE_DEFAULT_NAME const when absent (a consumer default,
  // not a schema `.default()`).
  AUTH_JWT_COOKIE_NAME: z.string().optional(),

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
  // Redis memory cap in bytes. Required, no default: the DLQ monitor derives
  // its memory-usage alert threshold from it, so it MUST track the redis
  // container's `--maxmemory`, or usage creeps toward OOM-kill unnoticed.
  REDIS_MAXMEMORY_BYTES: z.coerce.number().int().positive(),
  BULLMQ_PREFIX: z.string().optional(),
  // Consumed only by DLQMonitorService, which applies its own named default
  // when absent. A PRESENT value must be a whole positive number: `z.coerce`
  // fails boot loud rather than letting a typo degrade the alert silently.
  DLQ_ALERT_THRESHOLD: z.coerce.number().int().positive().optional(),

  // SMTP (email reminders)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // OpenTelemetry. The endpoint stays optional — the SDK only starts
  // when OTEL_EXPORTER_OTLP_ENDPOINT is set AND OTEL_SDK_DISABLED is not
  // 'true'. The toggle + sampler are required so the telemetry posture is
  // always explicit. See otel.bootstrap.ts.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_SDK_DISABLED: z.string(),
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1),
  OTEL_SERVICE_NAME: z.string().optional(),
  OTEL_SERVICE_VERSION: z.string().optional(),

  // Error capture (Bugsink/Sentry-compatible). Optional: `main.ts` inits the
  // SDK only when set. Read raw at module load there — before validateEnv()
  // runs — so this declaration is for coverage, not routing.
  SENTRY_DSN: z.string().optional(),
  // Browser → server log forwarder toggle (`main.ts`). Optional prod opt-in;
  // dev enables the forwarder via NODE_ENV, prod opts in with "true".
  CLIENT_LOG_FORWARDING: z.string().optional(),
  // Telegram bot token. Optional: unset/blank →
  // MockTelegramAdapter; a non-blank value activates real delivery. The
  // configured-check is centralised in `isTelegramConfigured`.
  TG_BOT_TOKEN: z.string().optional(),

  // PDF generation
  PDF_BASE_URL: z.url(),
  // Directory where the BullMQ worker writes generated PDFs and
  // where /pdfs static mount serves them. Resolved relative to the API's cwd
  // (apps/api/) at runtime — `./storage/pdfs` lands at `apps/api/storage/pdfs`.
  PDF_OUTPUT_DIR: z.string(),
  // Short-lived JWT signed at /trpc entry and injected as cookie into the
  // headless browser so PDF rendering can authenticate against
  // /weekly-report/* routes. Min 32 chars also enforced in the service.
  PDF_EXPORT_JWT_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH),

  // Heap threshold (bytes) for the /health/ready memory check. Required, no
  // default: readiness sheds traffic as the process nears the container memory
  // cap, so it must track that cap per environment (~75% of the api limit).
  HEAP_HEALTH_THRESHOLD_BYTES: z.coerce.number().int().positive(),

  // pg.Pool tunables consumed only by PrismaService, which applies its own named
  // defaults when absent. A PRESENT value must parse — pg coerces `max: 0` back
  // to 10 and hangs on a negative max; the timeouts allow 0 (0 disables them).
  DB_POOL_MAX: z.coerce.number().int().positive().optional(),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().optional(),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional(),
});

type ValidatedEnv = z.infer<typeof envObjectSchema>;

const addForbiddenDevModeIssue = (
  data: ValidatedEnv,
  ctx: z.RefinementCtx,
): void => {
  if (!data.AUTH_DEV_MODE) return;
  ctx.addIssue({
    code: "custom",
    message: "AUTH_DEV_MODE=true is forbidden when NODE_ENV=production",
    path: ["AUTH_DEV_MODE"],
  });
};

// FRONTEND_URLS (if set) must not include a wildcard. Wildcards are
// a security smell in production CORS — caller could spoof origin
// and bypass cookie SameSite= protections.
const addWildcardOriginIssue = (
  data: ValidatedEnv,
  ctx: z.RefinementCtx,
): void => {
  const origins = (data.FRONTEND_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origins.some((origin) => origin.includes("*"))) return;
  ctx.addIssue({
    code: "custom",
    message: 'FRONTEND_URLS origins must not include "*" in production',
    path: ["FRONTEND_URLS"],
  });
};

// SMTP must be configured in production. Without a host EmailService
// silently selects jsonTransport and drops every reminder; without a
// from-address it cannot address an envelope. Fail boot loud instead.
// A whitespace-only value is unusable, so it counts as absent here.
const SMTP_PRODUCTION_KEYS = ["SMTP_HOST", "SMTP_FROM"] as const;

const addMissingSmtpIssues = (
  data: ValidatedEnv,
  ctx: z.RefinementCtx,
): void => {
  SMTP_PRODUCTION_KEYS.filter((key) => !data[key]?.trim()).forEach((key) => {
    ctx.addIssue({
      code: "custom",
      message: `${key} is required when NODE_ENV=production`,
      path: [key],
    });
  });
};

// SAML/Keycloak must be configured in production once dev-login is off.
// The vars stay `.optional()` in the object shape (dev-login boots
// without an IdP); without this fence a prod boot with AUTH_DEV_MODE=false
// and no SAML env succeeds and looks healthy until the first login, when
// saml.strategy.ts's own requireEnv fails late. A whitespace-only value
// is unusable, so it counts as absent here.
const SAML_PRODUCTION_KEYS = [
  "KEYCLOAK_SAML_CALLBACK_URL",
  "KEYCLOAK_SAML_ENTRY_POINT",
  "KEYCLOAK_SAML_ISSUER",
  "KEYCLOAK_SAML_CERT",
] as const;

const addMissingSamlIssues = (
  data: ValidatedEnv,
  ctx: z.RefinementCtx,
): void => {
  if (data.AUTH_DEV_MODE) return;
  SAML_PRODUCTION_KEYS.filter((key) => !data[key]?.trim()).forEach((key) => {
    ctx.addIssue({
      code: "custom",
      message: `${key} is required when NODE_ENV=production and AUTH_DEV_MODE=false`,
      path: [key],
    });
  });
};

export const envSchema = envObjectSchema.superRefine((data, ctx) => {
  // Production fences. Boot must fail if any of these aren't met.
  if (data.NODE_ENV !== "production") return;
  addForbiddenDevModeIssue(data, ctx);
  addWildcardOriginIssue(data, ctx);
  addMissingSmtpIssues(data, ctx);
  addMissingSamlIssues(data, ctx);
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
