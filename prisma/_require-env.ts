// Mirror of the API's `requireEnv` (apps/api/src/lib/env.ts). The prisma
// toolchain (tsconfig.prisma.json) cannot resolve workspace packages, so the
// contract is restated here rather than imported: a missing value must abort
// the script, never degrade to a built-in default.
export function requireEnv(key: string): string {
  // ESLint lints this file under the default project (not tsconfig.prisma.json),
  // where `process` resolves to `any`; cast `process` itself to a concrete shape
  // so the no-unsafe-* family checks real types instead of `any`.
  const env = (process as { env: Record<string, string | undefined> }).env;
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}
