import type { EnvConfig } from "../config/env.schema";
import { buildRedisConnectionOptions } from "../config/redis-connection";

function getBullMQConnectionOptions(env: EnvConfig) {
  return {
    ...buildRedisConnectionOptions(env),
    maxRetriesPerRequest: null,
  };
}

function getBullMQPrefix(env: EnvConfig): string | undefined {
  const prefix = env.BULLMQ_PREFIX?.trim();
  return prefix ? prefix : undefined;
}

export function getBullMQOptions(env: EnvConfig) {
  const prefix = getBullMQPrefix(env);
  return {
    connection: getBullMQConnectionOptions(env),
    ...(prefix === undefined ? {} : { prefix }),
  };
}
