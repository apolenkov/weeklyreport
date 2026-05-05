import { z } from 'zod';

export const envSchema = z
  .object({
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
    DIRECT_URL: z.string().url().startsWith('postgresql://').optional(),
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
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

    // SMTP (email reminders)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),

    // PDF generation
    PDF_BASE_URL: z.string().url().default('http://localhost:3000'),
    // Phase 23-01: directory where the BullMQ worker writes generated PDFs and
    // where /pdfs static mount serves them. Default works on a dev workstation;
    // production overrides via .env (e.g. /var/lib/customreport/pdfs).
    PDF_OUTPUT_DIR: z.string().default('./apps/api/storage/pdfs'),
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
