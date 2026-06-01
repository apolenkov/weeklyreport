export function getBullMQConnectionOptions() {
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
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
