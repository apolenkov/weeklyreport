import type { EnvConfig } from "./env.schema";

const FAIL_OPEN_COMMAND_TIMEOUT_MS = 2000;

export interface FailOpenRedisConnectionOptions {
  readonly db: number;
  readonly host: string;
  readonly port: number;
  readonly lazyConnect: true;
  readonly maxRetriesPerRequest: 1;
  readonly commandTimeout: number;
}

// Single source for Redis host/port/database across every ioredis/BullMQ connection.
// Reads only the validated EnvConfig — never raw process.env — so a missing
// var fails at the boot fence and no fallback can reappear at a call site.
export function buildRedisConnectionOptions(
  env: Pick<EnvConfig, "REDIS_DB" | "REDIS_HOST" | "REDIS_PORT">,
): { db: number; host: string; port: number } {
  return { db: env.REDIS_DB, host: env.REDIS_HOST, port: env.REDIS_PORT };
}

// The default offline queue lets the first command trigger lazy connection;
// commandTimeout bounds that wait so a real outage still degrades promptly.
export function buildFailOpenRedisConnectionOptions(
  env: Pick<EnvConfig, "REDIS_DB" | "REDIS_HOST" | "REDIS_PORT">,
): FailOpenRedisConnectionOptions {
  return {
    ...buildRedisConnectionOptions(env),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    commandTimeout: FAIL_OPEN_COMMAND_TIMEOUT_MS,
  };
}
