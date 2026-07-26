import { MS_PER_SECOND } from "@customreport/shared";
import type { RequestHandler } from "express";
import rateLimit, {
  ipKeyGenerator,
  type Options,
  type Store,
} from "express-rate-limit";
import Redis from "ioredis";
import { type RedisReply, RedisStore } from "rate-limit-redis";

import type { AppLogger } from "../../lib/logger";
import type { EnvConfig } from "../config/env.schema";
import { buildRedisConnectionOptions } from "../config/redis-connection";
import { rateLimitHitsTotal } from "../metrics/metrics.registry.js";

const HTTP_TOO_MANY_REQUESTS = 429;
// Test-mode bumps every bucket to this figure so E2E suites firing 10+ rapid
// requests per spec don't flake on the production limits below.
const TEST_MODE_LIMIT_PER_MINUTE = 1000;
const AUTH_LIMIT_PER_MINUTE = 5;
const TRPC_LIMIT_PER_MINUTE = 200;
const VITALS_LIMIT_PER_MINUTE = 60;
const CLIENT_LOGS_LIMIT_PER_MINUTE = 60;
// Ties *_LIMIT_PER_MINUTE constants to a one-minute window.
const RATE_LIMIT_WINDOW_MS = 60_000;
// IETF draft-7 RateLimit response headers (express-rate-limit standardHeaders).
const RATE_LIMIT_STANDARD_HEADERS = "draft-7" as const;

// Host/port via buildRedisConnectionOptions (never raw process.env) so a
// missing var fails at the boot fence; lazyConnect keeps boot non-blocking.
function buildStoreClient(
  env: Pick<EnvConfig, "REDIS_HOST" | "REDIS_PORT"> | undefined,
): Redis | undefined {
  if (!env) {
    return undefined;
  }
  const client = new Redis({
    ...buildRedisConnectionOptions(env),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  client.on("error", () => undefined);
  return client;
}

// Distinct rl:<bucket>: prefix per limiter so buckets never share a counter;
// Redis-backed counts survive restart and close the 5×N MemoryStore window.
function redisStoreFor(client: Redis, bucket: string): RedisStore {
  return new RedisStore({
    prefix: `rl:${bucket}:`,
    sendCommand: (...args: string[]): Promise<RedisReply> =>
      client.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
  });
}

// `message` doubles as the bucket label the handler reports to logs/metrics.
function buildBaseConfig(logger: AppLogger): Partial<Options> {
  return {
    windowMs: RATE_LIMIT_WINDOW_MS,
    standardHeaders: RATE_LIMIT_STANDARD_HEADERS,
    legacyHeaders: false,
    // Fail open on store outage: library default rethrows and turns a Redis
    // blip into 500s. Unlimited-but-up beats down; health indicator still fires.
    passOnStoreError: true,
    // ipKeyGenerator normalises IPv6 by /64; without it low-bit churn bypasses
    // the limit and express-rate-limit emits ERR_ERL_KEY_GEN_IPV6 every request.
    keyGenerator: (req) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
      return ipKeyGenerator(ip);
    },
    handler: (req, res, _next, opts) => {
      const bucket =
        opts.statusCode === HTTP_TOO_MANY_REQUESTS
          ? String(opts.message)
          : "unknown";
      logger.warn("rate limit hit", {
        phase: "rate-limit",
        path: req.path,
        ip: req.ip,
        bucket,
      });
      // Surface to /metrics so the Grafana panel "Rate-limit hits by
      // bucket" has data.
      rateLimitHitsTotal.inc({ bucket });
      res.status(opts.statusCode).json({
        error: "rate_limit_exceeded",
        message: "Too many requests. Please retry shortly.",
        retryAfter: Math.ceil(opts.windowMs / MS_PER_SECOND),
      });
    },
  };
}

// Per-IP limiters for public ingress; Caddy-unmatched routes need their own
// bucket. Test-mode limits come from TEST_MODE_LIMIT_PER_MINUTE above.
export function createRateLimits(options: {
  logger: AppLogger;
  isTest: boolean;
  env?: Pick<EnvConfig, "REDIS_HOST" | "REDIS_PORT">;
  redis?: Redis;
}): {
  authLimiter: RequestHandler;
  trpcLimiter: RequestHandler;
  vitalsLimiter: RequestHandler;
  clientLogsLimiter: RequestHandler;
} {
  const { logger, isTest, env, redis } = options;

  // Production uses Redis so the window survives restart; isTest / env-less
  // unit suites keep MemoryStore. Optional injected `redis` for integration tests.
  const client = isTest ? undefined : (redis ?? buildStoreClient(env));
  const storeFor = (bucket: string): Store | undefined =>
    client ? redisStoreFor(client, bucket) : undefined;

  const baseConfig = buildBaseConfig(logger);
  const limiterFor = (bucket: string, limit: number): RequestHandler =>
    rateLimit({
      ...baseConfig,
      limit: isTest ? TEST_MODE_LIMIT_PER_MINUTE : limit,
      message: bucket,
      store: storeFor(bucket),
    });

  return {
    authLimiter: limiterFor("auth", AUTH_LIMIT_PER_MINUTE),
    trpcLimiter: limiterFor("trpc", TRPC_LIMIT_PER_MINUTE),
    // 60/min/IP covers a page's vitals beacons while capping anonymous abuse.
    vitalsLimiter: limiterFor("vitals", VITALS_LIMIT_PER_MINUTE),
    // Public, Caddy-unmatched ingress: own per-IP bucket caps app.log floods.
    clientLogsLimiter: limiterFor("client-logs", CLIENT_LOGS_LIMIT_PER_MINUTE),
  };
}
