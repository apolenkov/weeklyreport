import { Logger } from "@nestjs/common";
import { Redis } from "ioredis";

import type { EnvConfig } from "../config/env.schema";
import { buildFailOpenRedisConnectionOptions } from "../config/redis-connection";
import { redisCacheErrorsTotal } from "../metrics/metrics.registry.js";
import {
  parseJson,
  serializeForCache,
} from "./read-through-cache.serialization.js";

const SCAN_BATCH_SIZE = 100;
const CACHE_READ_PHASE = "cache.read";
const CACHE_INVALIDATE_PHASE = "cache.invalidate";
// One epoch per cache instance: invalidateByPrefix bumps it before its scan, and
// a compute that started earlier refuses to cache its pre-invalidation value.
// The Redis epoch fences across connections; an in-process counter also fences this
// process's computes when the epoch bump itself fails.
const GENERATION_KEY = "__invalidation_generation";

// Redis outage never breaks the read path: reads fall through to compute;
// writes are best-effort. Every degraded operation is logged AND counted so
// the cache cannot silently stop serving while callers see "fresh" data.
export interface RedisReadThroughCache {
  readonly getOrCompute: <T>(
    key: string,
    fn: () => Promise<T>,
    validate?: (value: unknown) => value is T,
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

function parseCachedValue(
  logger: Logger,
  key: string,
  cached: string,
  validate: ((value: unknown) => boolean) | undefined,
): unknown {
  const outcome = parseJson(cached);
  if (!outcome.ok) {
    logger.warn("cache value parse failed; recomputing", {
      phase: CACHE_READ_PHASE,
      key,
    });
    redisCacheErrorsTotal.inc({ operation: "parse" });
    return undefined;
  }
  const parsed = outcome.value;
  if (validate === undefined) {
    return parsed;
  }
  try {
    if (validate(parsed)) {
      return parsed;
    }
  } catch (error) {
    logger.warn("cache value validator threw; recomputing", {
      phase: CACHE_READ_PHASE,
      key,
      error: describeError(error),
    });
    redisCacheErrorsTotal.inc({ operation: "validation" });
    return undefined;
  }
  logger.warn("cache value failed validation; recomputing", {
    phase: CACHE_READ_PHASE,
    key,
  });
  redisCacheErrorsTotal.inc({ operation: "validation" });
  return undefined;
}

// The epoch comparison and the write happen in ONE Redis round trip, so an
// invalidation cannot land between them and be overwritten by a compute that
// already captured its pre-invalidation epoch. Returns 1 when the value was
// written, 0 when the epoch moved on.
const WRITE_IF_GENERATION_MATCHES = `
local current = redis.call('GET', KEYS[1])
if current == false then current = '0' end
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`;

interface CacheRuntime {
  readonly redis: Redis;
  readonly logger: Logger;
  readonly ttlSeconds: number;
  readonly generationKey: string;
  readonly localInvalidations: () => number;
}

async function writeIfGenerationMatches(
  runtime: CacheRuntime,
  namespaced: string,
  expectedGeneration: string,
  serialized: string,
): Promise<boolean> {
  const { redis, generationKey, ttlSeconds } = runtime;
  const result: unknown = await redis.eval(
    WRITE_IF_GENERATION_MATCHES,
    2,
    generationKey,
    namespaced,
    expectedGeneration,
    serialized,
    String(ttlSeconds),
  );
  return result === 1;
}

type CacheReadState =
  | { readonly ok: false; readonly error: unknown }
  | {
      readonly ok: true;
      readonly cached: string | null;
      readonly generation: string;
    };

const READ_STATE_SCRIPT = `
local cached, generation = redis.call('GET', KEYS[1]), redis.call('GET', KEYS[2])
return {cached, (generation or '0')}`;

async function readCacheState(
  redis: Redis,
  namespaced: string,
  generationKey: string,
): Promise<CacheReadState> {
  try {
    const raw: unknown = await redis.eval(
      READ_STATE_SCRIPT,
      2,
      namespaced,
      generationKey,
    );
    if (!Array.isArray(raw) || raw.length !== 2)
      return { ok: false, error: new Error("cache state script shape") };
    const [cachedRaw, generationRaw] = raw as [unknown, unknown];
    const cached = typeof cachedRaw === "string" ? cachedRaw : null;
    const generation = typeof generationRaw === "string" ? generationRaw : "0";
    return { ok: true, cached, generation };
  } catch (error) {
    return { ok: false, error };
  }
}

async function getOrComputeImpl<T>(
  runtime: CacheRuntime,
  entry: { readonly key: string; readonly namespaced: string },
  fn: () => Promise<T>,
  validate: ((value: unknown) => boolean) | undefined,
): Promise<T> {
  const { redis, logger, generationKey } = runtime;
  const { key, namespaced } = entry;
  const invalidationsBefore = runtime.localInvalidations();
  const state = await readCacheState(redis, namespaced, generationKey);
  if (state.ok && state.cached !== null) {
    const parsed = parseCachedValue(logger, key, state.cached, validate);
    if (parsed !== undefined) {
      logger.debug(`cache hit key=${key}`);
      return parsed as T;
    }
  }
  if (!state.ok) {
    logger.warn("cache read failed; falling through to compute", {
      phase: CACHE_READ_PHASE,
      key,
      error: describeError(state.error),
    });
    redisCacheErrorsTotal.inc({ operation: "read" });
  }
  // Captured before the compute: an invalidation that commits while fn() runs
  // must stop this value from being cached.
  const generationBefore = state.ok ? state.generation : null;
  logger.debug(`cache miss key=${key}`);
  const fresh = await fn();
  const serialized = serializeForCache(fresh);
  if (!serialized.ok || generationBefore === null) {
    // Either the value has no cacheable JSON form, or the epoch could not be read
    // before the compute so freshness cannot be proven; the caller still gets its
    // value and the cache simply stays unwritten.
    logger.debug(`cache write skipped key=${key}`);
    return fresh;
  }
  if (runtime.localInvalidations() !== invalidationsBefore) {
    logger.debug(
      `cache write skipped after in-process invalidation key=${key}`,
    );
    return fresh;
  }
  try {
    const written = await writeIfGenerationMatches(
      runtime,
      namespaced,
      generationBefore,
      serialized.value,
    );
    if (!written) {
      // An invalidation committed while this compute was running, so its input
      // may predate that commit; caching it would resurrect stale data.
      logger.debug(`cache write skipped after invalidation key=${key}`);
    }
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

// A failed batch delete is attributed to the delete command, not to the SCAN
// stream, so the metric names the operation that actually degraded. Remaining
// batches still run: a partial invalidation beats an aborted one.
async function deleteBatch(
  redis: Redis,
  logger: Logger,
  batch: readonly string[],
): Promise<void> {
  if (batch.length === 0) {
    return;
  }
  try {
    await redis.del(...batch);
  } catch (error) {
    logger.warn("cache invalidation delete failed", {
      phase: CACHE_INVALIDATE_PHASE,
      error: describeError(error),
    });
    redisCacheErrorsTotal.inc({ operation: "delete" });
  }
}

async function scanAndDelete(
  runtime: CacheRuntime,
  match: string,
): Promise<void> {
  const { redis, logger, generationKey } = runtime;
  // ioredis owns the SCAN cursor protocol; the stream just hands us batches.
  const batches: AsyncIterable<readonly string[]> = redis.scanStream({
    match,
    count: SCAN_BATCH_SIZE,
  });
  for await (const batch of batches) {
    const dataKeys = batch.filter((key) => key !== generationKey);
    await deleteBatch(redis, logger, dataKeys);
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
  const generationKey = `${keyPrefix}${GENERATION_KEY}`;
  const invalidations = { count: 0 };
  const runtime: CacheRuntime = {
    redis,
    logger,
    ttlSeconds,
    generationKey,
    localInvalidations: () => invalidations.count,
  };
  // A Redis blip must not crash the process, but it also must not pass
  // unseen: log AND count every connection-level error event.
  redis.on("error", (error: unknown) => {
    logger.warn("redis connection error", {
      phase: "cache.redis",
      error: describeError(error),
    });
    redisCacheErrorsTotal.inc({ operation: "connection" });
  });

  return {
    getOrCompute: <T>(
      key: string,
      fn: () => Promise<T>,
      validate?: (value: unknown) => value is T,
    ): Promise<T> =>
      getOrComputeImpl(
        runtime,
        { key, namespaced: `${keyPrefix}${key}` },
        fn,
        validate,
      ),

    invalidateByPrefix: async (prefix: string): Promise<void> => {
      // The epoch bump precedes the scan: a compute that is already running when
      // the invalidation commits must not cache its pre-commit value afterwards.
      // Advanced before any Redis call so this process fences its in-flight computes
      // even when the epoch INCR fails.
      invalidations.count += 1;
      try {
        await redis.incr(generationKey);
      } catch (error) {
        logger.warn("cache invalidation epoch bump failed", {
          phase: CACHE_INVALIDATE_PHASE,
          prefix,
          error: describeError(error),
        });
        redisCacheErrorsTotal.inc({ operation: "write" });
      }
      try {
        await scanAndDelete(runtime, `${keyPrefix}${prefix}*`);
      } catch (error) {
        logger.warn("cache invalidation failed", {
          phase: CACHE_INVALIDATE_PHASE,
          prefix,
          error: describeError(error),
        });
        redisCacheErrorsTotal.inc({ operation: "scan" });
      }
    },

    close: async (): Promise<void> => {
      await redis.quit().catch((error: unknown) => {
        logger.warn("redis quit failed", {
          phase: "cache.redis",
          error: describeError(error),
        });
        redisCacheErrorsTotal.inc({ operation: "connection" });
      });
    },
  };
}
