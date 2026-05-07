import { z } from 'zod';

export const envSchema = z
  .object({
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
    DIRECT_URL: z.string().url().startsWith('postgresql://').optional(),
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    // 36-04: optional CSV of additional allowed origins for CORS. Lets
    // prod accept e.g. customreport.example.com + admin.customreport.
    // example.com from the same API instance. Wildcards (*) are rejected
    // in superRefine when NODE_ENV=production.
    FRONTEND_URLS: z.string().optional(),
    AUTH_DEV_MODE: z.string().default('false').transform((v) => v === 'true'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    LOG_DIR: z.string().optional(),

    // Auth / JWT
    AUTH_JWT_SECRET: z.string().min(32).optional(),

    // SAML / Keycloak (validated at runtime by saml.strategy.ts requireEnv)
    KEYCLOAK_SAML_CALLBACK_URL: z.string().url().optional(),
    KEYCLOAK_SAML_ENTRY_POINT: z.string().url().optional(),
    KEYCLOAK_SAML_ISSUER: z.string().optional(),
    KEYCLOAK_SAML_CERT: z.string().optional(),

    // Redis (BullMQ)
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    BULLMQ_PREFIX: z.string().optional(),

    // SMTP (email reminders)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),

    // OpenTelemetry (37-01). All optional — SDK only starts when
    // OTEL_EXPORTER_OTLP_ENDPOINT is set AND OTEL_SDK_DISABLED is not
    // 'true'. See apps/api/src/infrastructure/otel/otel.bootstrap.ts.
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    OTEL_SDK_DISABLED: z.string().default('false'),
    OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(0.1),
    OTEL_SERVICE_NAME: z.string().optional(),
    OTEL_SERVICE_VERSION: z.string().optional(),

    // PDF generation
    PDF_BASE_URL: z.string().url().default('http://localhost:3000'),
    // Phase 23-01: directory where the BullMQ worker writes generated PDFs and
    // where /pdfs static mount serves them. Resolved relative to the API's cwd
    // (apps/api/) at runtime — `./storage/pdfs` lands at `apps/api/storage/pdfs`
    // regardless of how the dev script is launched. The earlier
    // `./apps/api/storage/pdfs` default doubled the path when cwd was already
    // apps/api/, producing a stray `apps/api/apps/api/storage/pdfs`.
    // Production overrides via .env (e.g. /var/lib/customreport/pdfs).
    PDF_OUTPUT_DIR: z.string().default('./storage/pdfs'),
    // CC-1 (Phase 28-02): short-lived JWT signed at /trpc entry and injected
    // as cookie into the headless browser so PDF rendering can authenticate
    // against /weekly-report/* routes. Min 16 chars enforced in the service.
    PDF_EXPORT_JWT_SECRET: z
      .string()
      .min(16)
      .default('dev-only-replace-in-production-min-32-chars'),
  })
  .superRefine((data, ctx) => {
    if (!data.AUTH_DEV_MODE && !data.AUTH_JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AUTH_JWT_SECRET is required when AUTH_DEV_MODE is not true (min 32 chars)',
        path: ['AUTH_JWT_SECRET'],
      });
    }

    // 36-03: production fences. Boot must fail if any of these aren't met.
    if (data.NODE_ENV === 'production') {
      if (data.AUTH_DEV_MODE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'AUTH_DEV_MODE=true is forbidden when NODE_ENV=production',
          path: ['AUTH_DEV_MODE'],
        });
      }
      if (data.PDF_EXPORT_JWT_SECRET === 'dev-only-replace-in-production-min-32-chars') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PDF_EXPORT_JWT_SECRET must be overridden in production (default dev value detected)',
          path: ['PDF_EXPORT_JWT_SECRET'],
        });
      }
      // FRONTEND_URLS (if set) must not include a wildcard. Wildcards are
      // a security smell in production CORS — caller could spoof origin
      // and bypass cookie SameSite= protections.
      if (data.FRONTEND_URLS) {
        const origins = data.FRONTEND_URLS.split(',').map((s) => s.trim()).filter(Boolean);
        if (origins.includes('*')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'FRONTEND_URLS must not include "*" in production',
            path: ['FRONTEND_URLS'],
          });
        }
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}
