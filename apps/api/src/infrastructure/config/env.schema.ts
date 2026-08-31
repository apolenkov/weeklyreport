import { z } from "zod";

import { logLevelSchema } from "../../lib/logger.js";
import { SAML_ENV_KEYS } from "../../lib/saml-env-keys.js";
import { REPORT_ASSISTANT_ENV_KEYS } from "./report-assistant-env-keys.js";

const MIN_JWT_SECRET_LENGTH = 32;
const MAX_REDIS_LOGICAL_DATABASE = 15;
const MIN_SIMILARITY_THRESHOLD = 0;
const MAX_SIMILARITY_THRESHOLD = 1;
const positiveIntegerEnv = z.coerce.number().int().positive();

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.url().optional(),
);

// No `.default()` anywhere by design: every value is REQUIRED and supplied
// explicitly per environment, so a misconfigured deploy fails boot loud instead
// of running on a silent (e.g. localhost) default. See env-schema-coverage spec.
const envObjectSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgresql://"),
  PORT: z.coerce.number().int().positive(),
  API_HOST: z.enum(["127.0.0.1", "0.0.0.0"]),
  NODE_ENV: z.enum(["development", "production", "test"]),
  FRONTEND_URL: z.url(),
  // Base URL the reminder scheduler embeds in notification email links
  // (`reminders.scheduler.ts`). Required so prod emails never link to
  // localhost; in dev/compose it is set to the same web origin as FRONTEND_URL.
  APP_BASE_URL: z.url(),
  // Optional CSV of additional allowed origins for CORS (e.g. prod host +
  // admin host on one API instance). Wildcards (*) are rejected in
  // superRefine when NODE_ENV=production.
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

  // Auth / JWT. Required (min 32): the JWT signer is built at boot in EVERY
  // mode — dev-login still issues a session JWT — so a config without it
  // crashes at controller construction regardless of AUTH_DEV_MODE.
  AUTH_JWT_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH),

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
  REDIS_DB: z.coerce.number().int().min(0).max(MAX_REDIS_LOGICAL_DATABASE),
  // Redis memory cap in bytes. Required, no default: the DLQ monitor derives
  // its memory-usage alert threshold from it, so it MUST track the redis
  // container's `--maxmemory`, or usage creeps toward OOM-kill unnoticed.
  REDIS_MAXMEMORY_BYTES: z.coerce.number().int().positive(),
  // Consumed only by DLQMonitorService, which applies its own named default
  // when absent. A PRESENT value must be a whole positive number: `z.coerce`
  // fails boot loud rather than letting a typo degrade the alert silently.
  DLQ_ALERT_THRESHOLD: z.coerce.number().int().positive().optional(),

  // The provider and prompt control plane is database-backed. Deployment
  // configuration owns only credential encryption, endpoint allowlisting,
  // and bounded runtime limits.
  [REPORT_ASSISTANT_ENV_KEYS.providerConfigEncryptionKey]: z
    .string()
    .trim()
    .min(1),
  [REPORT_ASSISTANT_ENV_KEYS.providerConfigKeyVersion]: positiveIntegerEnv,
  [REPORT_ASSISTANT_ENV_KEYS.providerAllowedOrigins]: z.string().trim().min(1),
  // Explicit owner approval for sending report-derived content to an
  // activated provider. The fail-closed deployment switch covers privacy,
  // retention/training posture, endpoint region, and network destination.
  [REPORT_ASSISTANT_ENV_KEYS.outboundDataApproved]: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  [REPORT_ASSISTANT_ENV_KEYS.inputVersion]: z.string().trim().min(1),
  [REPORT_ASSISTANT_ENV_KEYS.similarityThreshold]: z.coerce
    .number()
    .min(MIN_SIMILARITY_THRESHOLD)
    .max(MAX_SIMILARITY_THRESHOLD),
  [REPORT_ASSISTANT_ENV_KEYS.candidateLimit]: positiveIntegerEnv,
  [REPORT_ASSISTANT_ENV_KEYS.readThroughLimit]: positiveIntegerEnv,
  [REPORT_ASSISTANT_ENV_KEYS.exhaustiveLimit]: positiveIntegerEnv,
  [REPORT_ASSISTANT_ENV_KEYS.contextTokenBudget]: positiveIntegerEnv,
  [REPORT_ASSISTANT_ENV_KEYS.providerTimeoutMs]: positiveIntegerEnv,
  [REPORT_ASSISTANT_ENV_KEYS.plannerMaxTokens]: positiveIntegerEnv,
  [REPORT_ASSISTANT_ENV_KEYS.answerMaxTokens]: positiveIntegerEnv,
  [REPORT_ASSISTANT_ENV_KEYS.embeddingBatchSize]: positiveIntegerEnv,
  [REPORT_ASSISTANT_ENV_KEYS.embeddingTokenBudget]: positiveIntegerEnv,

  // SMTP (email reminders). The fields stay optional for dev/test; the
  // production fence below requires host, port, and sender together.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // OpenTelemetry. The endpoint stays optional — the SDK only starts when
  // OTEL_EXPORTER_OTLP_ENDPOINT is set AND OTEL_SDK_DISABLED is not 'true'.
  // The toggle + sampler are required so the telemetry posture is explicit.
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  OTEL_SDK_DISABLED: z.string(),
  OTEL_TRACES_SAMPLER_ARG: z
    .string()
    .trim()
    .min(1)
    .transform(Number)
    .pipe(z.number().min(0).max(1)),
  OTEL_SERVICE_NAME: z.string().optional(),
  // Optional for dev/test; production requires an exact release identity even
  // while export is disabled so later enablement cannot inherit "dev".
  OTEL_SERVICE_VERSION: z.string().optional(),

  // Error capture (Bugsink/Sentry-compatible). Optional: the dynamic Sentry
  // bootstrap reads this only after startup validation; this schema remains
  // the single validation and coverage owner.
  SENTRY_DSN: z.string().optional(),
  // Browser → server log forwarder toggle (`main.ts`). This schema owns its
  // validation; optional prod opt-in;
  // dev enables the forwarder via NODE_ENV, prod opts in with "true".
  CLIENT_LOG_FORWARDING: z.string().optional(),
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

  // pg.Pool tunables are required so production capacity and timeout policy
  // cannot silently drift from the deployment contract.
  DB_POOL_MAX: z.coerce.number().int().positive(),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative(),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().nonnegative(),
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

// SMTP must be configured in production: without a host EmailService silently
// drops reminders (jsonTransport), and without a from-address it cannot address
// an envelope. A whitespace-only value counts as absent.
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

const addMissingSmtpPortIssue = (
  data: ValidatedEnv,
  ctx: z.RefinementCtx,
): void => {
  if (data.SMTP_PORT !== undefined) return;
  ctx.addIssue({
    code: "custom",
    message: "SMTP_PORT is required when NODE_ENV=production",
    path: ["SMTP_PORT"],
  });
};

const addMissingReleaseVersionIssue = (
  data: ValidatedEnv,
  ctx: z.RefinementCtx,
): void => {
  if (data.OTEL_SERVICE_VERSION?.trim()) return;
  ctx.addIssue({
    code: "custom",
    message: "OTEL_SERVICE_VERSION is required when NODE_ENV=production",
    path: ["OTEL_SERVICE_VERSION"],
  });
};

// SAML/Keycloak must be configured in production once dev-login is off. The
// vars stay `.optional()` (dev-login boots without an IdP); this fence fails
// boot loud before saml.strategy.ts's requireEnv would fail late.
const SAML_PRODUCTION_KEYS = SAML_ENV_KEYS;

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
  addMissingSmtpPortIssue(data, ctx);
  addMissingReleaseVersionIssue(data, ctx);
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
