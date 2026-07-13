import type { EnvConfig } from "../config/env.schema";
import { buildRedisConnectionOptions } from "../config/redis-connection";

export function getBullMQConnectionOptions(env: EnvConfig) {
  return {
    ...buildRedisConnectionOptions(env),
    maxRetriesPerRequest: null,
  };
}

export function getBullMQPrefix(env: EnvConfig): string | undefined {
  const prefix = env.BULLMQ_PREFIX?.trim();
  return prefix ? prefix : undefined;
}

export function getBullMQOptions(env: EnvConfig) {
  return {
    connection: getBullMQConnectionOptions(env),
    prefix: getBullMQPrefix(env),
  };
}
