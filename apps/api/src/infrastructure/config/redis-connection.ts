import type { EnvConfig } from "./env.schema";

// Single source for Redis host/port across every ioredis/BullMQ connection.
// Reads only the validated EnvConfig — never raw process.env — so a missing
// var fails at the boot fence and no fallback can reappear at a call site.
/**
 * Build Redis Connection Options.
 * @param env - The env argument.
 */
export function buildRedisConnectionOptions(
  env: Pick<EnvConfig, "REDIS_HOST" | "REDIS_PORT">,
): { host: string; port: number } {
  return { host: env.REDIS_HOST, port: env.REDIS_PORT };
}
