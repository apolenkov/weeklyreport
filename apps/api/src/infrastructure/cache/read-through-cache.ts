import { Logger } from "@nestjs/common";
import { Redis } from "ioredis";

import type { EnvConfig } from "../config/env.schema";
import { buildFailOpenRedisConnectionOptions } from "../config/redis-connection";
import { redisCacheErrorsTotal } from "../metrics/metrics.registry.js";

const SCAN_BATCH_SIZE = 100;
const CACHE_READ_PHASE = "cache.read";

// Redis outage never breaks the read path: reads fall through to compute;
// writes are best-effort. Every degraded operation is logged AND counted so
// the cache cannot silently stop serving while callers see "fresh" data.
export interface RedisReadThroughCache {
  readonly getOrCompute: <T>(
    key: string,
    fn: () => Promise<T>,
    validate?: (value: unknown) => boolean,
  ) => Promise<T>;
  readonly invalidateByPrefix: (prefix: string) => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface ReadThroughCacheOptions {
  readonly connection: Pick<
    EnvConfig,
    "REDIS_DB" | "REDIS_HOST" | "REDIS_PORT"
  >;
  readonly loggerName: string;
  readonly ttlSeconds: number;
  readonly keyPrefix: string;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// A cache hit is only trusted when the parsed value passes the optional
// validator; a parse or validation failure degrades to a recompute and is
// counted. Returns undefined to signal "fall through to compute".
function parseCachedValue(
  logger: Logger,
  key: string,
  cached: string,
  validate: ((value: unknown) => boolean) | undefined,
): unknown {
  try {
    const parsed: unknown = JSON.parse(cached);
    if (validate === undefined || validate(parsed)) {
      return parsed;
    }
    logger.warn("cache value failed validation; recomputing", {
      phase: CACHE_READ_PHASE,
      key,
    });
    redisCacheErrorsTotal.inc({ operation: "validation" });
    return undefined;
  } catch {
    logger.warn("cache value parse failed; recomputing", {
      phase: CACHE_READ_PHASE,
      key,
    });
    redisCacheErrorsTotal.inc({ operation: "parse" });
    return undefined;
  }
}

async function getOrComputeImpl<T>(
  redis: Redis,
  logger: Logger,
  namespaced: string,
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
  validate: ((value: unknown) => boolean) | undefined,
): Promise<T> {
  try {
    const cached = await redis.get(namespaced);
    if (cached !== null) {
      const parsed = parseCachedValue(logger, key, cached, validate);
      if (parsed !== undefined) {
        logger.debug(`cache hit key=${key}`);
        return parsed as T;
      }
    }
  } catch (error) {
    logger.warn("cache read failed; falling through to compute", {
      phase: CACHE_READ_PHASE,
      key,
      error: describeError(error),
    });
    redisCacheErrorsTotal.inc({ operation: "read" });
  }
  logger.debug(`cache miss key=${key}`);
  const fresh = await fn();
  try {
    await redis.setex(namespaced, ttlSeconds, JSON.stringify(fresh));
  } catch (error) {
    logger.warn("cache write failed", {
      phase: "cache.write",
      key,
      error: describeError(error),
    });
    redisCacheErrorsTotal.inc({ operation: "write" });
  }
  return fresh;
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

export function createRedisReadThroughCache(
  options: ReadThroughCacheOptions,
): RedisReadThroughCache {
  const { connection, loggerName, ttlSeconds, keyPrefix } = options;
  const logger = new Logger(loggerName);
  const redis = new Redis({
    ...buildFailOpenRedisConnectionOptions(connection),
  });
  // A Redis blip must not crash the process, but it also must not pass
  // unseen: log every connection-level error event.
  redis.on("error", (error: unknown) => {
    logger.warn("redis connection error", {
      phase: "cache.redis",
      error: describeError(error),
    });
  });

  return {
    getOrCompute: <T>(
      key: string,
      fn: () => Promise<T>,
      validate?: (value: unknown) => boolean,
    ): Promise<T> =>
      getOrComputeImpl(
        redis,
        logger,
        `${keyPrefix}${key}`,
        key,
        ttlSeconds,
        fn,
        validate,
      ),

    invalidateByPrefix: async (prefix: string): Promise<void> => {
      try {
        await scanAndDelete(redis, `${keyPrefix}${prefix}*`);
      } catch (error) {
        logger.warn("cache invalidation failed", {
          phase: "cache.invalidate",
          prefix,
          error: describeError(error),
        });
        redisCacheErrorsTotal.inc({ operation: "scan" });
      }
    },

    close: async (): Promise<void> => {
      await redis.quit().catch(() => undefined);
    },
  };
}
