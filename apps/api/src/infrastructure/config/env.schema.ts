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
