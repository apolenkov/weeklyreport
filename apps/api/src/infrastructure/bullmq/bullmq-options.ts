import { requireEnv } from "../../lib/env.js";

export function getBullMQConnectionOptions() {
  return {
    host: requireEnv(process.env, "REDIS_HOST"),
    port: Number(requireEnv(process.env, "REDIS_PORT")),
    maxRetriesPerRequest: null,
  };
}

export function getBullMQPrefix(): string | undefined {
  const prefix = process.env.BULLMQ_PREFIX?.trim();
  return prefix ? prefix : undefined;
}

export function getBullMQOptions() {
  return {
    connection: getBullMQConnectionOptions(),
    prefix: getBullMQPrefix(),
  };
}
