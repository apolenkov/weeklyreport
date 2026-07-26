import { Logger } from "@nestjs/common";
import Redis from "ioredis";

import type { EnvConfig } from "../config/env.schema";
import { buildRedisConnectionOptions } from "../config/redis-connection";

/** SCAN batch size for the prefix-invalidation walk (non-blocking, unlike KEYS). */
const SCAN_BATCH_SIZE = 100;

// Redis outage never breaks the read path: reads fall through to compute; writes are best-effort.
export interface RedisReadThroughCache {
  getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T>;
  invalidateByPrefix(prefix: string): Promise<void>;
  close(): Promise<void>;
}

export interface ReadThroughCacheOptions {
  readonly connection: Pick<EnvConfig, "REDIS_HOST" | "REDIS_PORT">;
  readonly loggerName: string;
  readonly ttlSeconds: number;
  readonly keyPrefix: string;
}

async function scanAndDelete(redis: Redis, match: string): Promise<void> {
  // ioredis owns the SCAN cursor protocol; the stream just hands us batches.
  const batches: AsyncIterable<readonly string[]> = redis.scanStream({
    match,
    count: SCAN_BATCH_SIZE,
  });
  for await (const batch of batches) {
    // SCAN can yield an empty batch, and del() with no arguments errors.
    if (batch.length > 0) {
      await redis.del(...batch);
    }
  }
}

/**
 * Create Redis Read Through Cache.
 * @param options - The options argument.
 */
export function createRedisReadThroughCache(
  options: ReadThroughCacheOptions,
): RedisReadThroughCache {
  const { connection, loggerName, ttlSeconds, keyPrefix } = options;
  const logger = new Logger(loggerName);
  const redis = new Redis({
    ...buildRedisConnectionOptions(connection),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  // Suppress unhandled error events so a Redis blip cannot crash the process.
  redis.on("error", () => undefined);

  return {
    async getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const namespaced = `${keyPrefix}${key}`;
      try {
        const cached = await redis.get(namespaced);
        if (cached !== null) {
          logger.debug(`cache hit key=${key}`);
          return JSON.parse(cached) as T;
        }
      } catch {
        // Cache read failure is non-fatal — fall through to compute.
      }
      logger.debug(`cache miss key=${key}`);
      const fresh = await fn();
      try {
        await redis.setex(namespaced, ttlSeconds, JSON.stringify(fresh));
      } catch {
        // Cache write failure is non-fatal.
      }
      return fresh;
    },

    async invalidateByPrefix(prefix: string): Promise<void> {
      try {
        await scanAndDelete(redis, `${keyPrefix}${prefix}*`);
      } catch {
        // Best-effort invalidation; stale entries still expire on their TTL.
      }
    },

    async close(): Promise<void> {
      await redis.quit().catch(() => undefined);
    },
  };
}
