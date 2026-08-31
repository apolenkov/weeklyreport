import type { EnvConfig } from "../config/env.schema";
import { buildRedisConnectionOptions } from "../config/redis-connection";

function getBullMQConnectionOptions(env: EnvConfig) {
  return {
    ...buildRedisConnectionOptions(env),
    maxRetriesPerRequest: null,
  };
}

export function getBullMQOptions(env: EnvConfig) {
  return {
    connection: getBullMQConnectionOptions(env),
  };
}
