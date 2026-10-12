import { requireEnv as requireApiEnv } from "../../apps/api/src/lib/env.js";

/** Prisma CLI uses the API's bare presence contract without altering raw values. */
export function requireEnv(
  key: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return requireApiEnv(environment, key);
}
