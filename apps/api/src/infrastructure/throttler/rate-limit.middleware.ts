import { inspect } from "node:util";

import { MS_PER_SECOND } from "@weeklyreport/shared";
import type { RequestHandler } from "express";
import rateLimit, {
  ipKeyGenerator,
  type Options,
  type Store,
} from "express-rate-limit";
import { Redis } from "ioredis";
import { type RedisReply, RedisStore } from "rate-limit-redis";

import { UNKNOWN_CLIENT_IP } from "../../lib/actor-sentinels";
import type { AppLogger } from "../../lib/logger";
import type { EnvConfig } from "../config/env.schema";
import { buildRedisConnectionOptions } from "../config/redis-connection";
import {
  rateLimitHitsTotal,
  rateLimitStoreErrorsTotal,
} from "../metrics/metrics.registry.js";
import { RateLimitDegradedStore } from "./rate-limit-degraded-store.js";

const HTTP_TOO_MANY_REQUESTS = 429;
// Test-mode bumps every bucket to this figure so E2E suites firing 10+ rapid
// requests per spec don't flake on the production limits below.
const TEST_MODE_LIMIT_PER_MINUTE = 1000;
const AUTH_LIMIT_PER_MINUTE = 5;
const TRPC_LIMIT_PER_MINUTE = 200;
const VITALS_LIMIT_PER_MINUTE = 60;
const CLIENT_LOGS_LIMIT_PER_MINUTE = 60;
const PRODUCT_FEEDBACK_LIMIT_PER_MINUTE = 30;
// Ties *_LIMIT_PER_MINUTE constants to a one-minute window.
const RATE_LIMIT_WINDOW_MS = 60_000;
// IETF draft-7 RateLimit response headers (express-rate-limit standardHeaders).
const RATE_LIMIT_STANDARD_HEADERS = "draft-7" as const;

interface RateLimitFactoryOptions {
  logger: AppLogger;
  isTest: boolean;
  env?: Pick<EnvConfig, "REDIS_DB" | "REDIS_HOST" | "REDIS_PORT">;
  redis?: Redis;
}

interface RateLimitHandlers {
  authLimiter: RequestHandler;
  trpcLimiter: RequestHandler;
  vitalsLimiter: RequestHandler;
  clientLogsLimiter: RequestHandler;
  feedbackLimiter: RequestHandler;
  shutdownRateLimitStore: () => Promise<void>;
}

// Host/port via buildRedisConnectionOptions (never raw process.env) so a
// missing var fails at the boot fence; lazyConnect lets the factory own the
// explicit readiness boundary below.
function buildStoreClient(
  env: Pick<EnvConfig, "REDIS_DB" | "REDIS_HOST" | "REDIS_PORT"> | undefined,
): Redis | undefined {
  if (!env) {
    return undefined;
  }
  return new Redis({
    ...buildRedisConnectionOptions(env),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
}

// rate-limit-redis only understands boolean/number/string (or arrays of those)
// replies; anything else is a contract breach — reject it loudly instead of
// asserting the reply shape with a cast.
export function isRateLimitRedisReply(value: unknown): value is RedisReply {
  return (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string" ||
    (Array.isArray(value) && value.every(isRateLimitRedisReply))
  );
}

function describeRedisReply(value: unknown): string {
  return typeof value === "string" ? value : inspect(value);
}

// Distinct rl:<bucket>: prefix per limiter so buckets never share a counter;
// Redis-backed counts survive restart and close the 5×N MemoryStore window.
function redisStoreFor(client: Redis, bucket: string): RedisStore {
  return new RedisStore({
    prefix: `rl:${bucket}:`,
    sendCommand: async (...args: string[]): Promise<RedisReply> => {
      const [command, ...rest] = args;
      if (command === undefined) {
        throw new Error("rate-limit Redis store: sendCommand needs a command.");
      }
      const reply = await client.call(command, ...rest);
      if (!isRateLimitRedisReply(reply)) {
        throw new Error(
          `rate-limit Redis store: unexpected reply ${describeRedisReply(reply)}`,
        );
      }
      return reply;
    },
  });
}

// `message` doubles as the bucket label the handler reports to logs/metrics.
function buildBaseConfig(logger: AppLogger): Partial<Options> {
  return {
    windowMs: RATE_LIMIT_WINDOW_MS,
    standardHeaders: RATE_LIMIT_STANDARD_HEADERS,
    legacyHeaders: false,
    // Store faults are handled by RateLimitDegradedStore. Reaching this layer
    // means both enforcement paths failed, so the request must not bypass.
    passOnStoreError: false,
    // ipKeyGenerator normalises IPv6 by /64; without it low-bit churn bypasses
    // the limit and express-rate-limit emits ERR_ERL_KEY_GEN_IPV6 every request.
    keyGenerator: (req) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? UNKNOWN_CLIENT_IP;
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

const requireProductionClient = (
  isTest: boolean,
  client: Redis | undefined,
): void => {
  if (!isTest && client === undefined) {
    throw new Error(
      "Rate-limit Redis store is required outside test mode: REDIS_HOST/REDIS_PORT env or an injected redis client is missing.",
    );
  }
};

const connectOwnedClient = async (
  injectedClient: Redis | undefined,
  client: Redis | undefined,
): Promise<Redis | undefined> => {
  const ownedClient = injectedClient === undefined ? client : undefined;
  if (ownedClient === undefined) return undefined;
  try {
    await ownedClient.connect();
    return ownedClient;
  } catch (error: unknown) {
    ownedClient.disconnect();
    throw error;
  }
};

const shutdownFor = (ownedClient: Redis | undefined) => {
  const state = { closed: false };
  return (): Promise<void> => {
    if (!state.closed && ownedClient !== undefined) {
      state.closed = true;
      ownedClient.disconnect();
    }
    return Promise.resolve();
  };
};

// Per-IP limiters for public ingress; Caddy-unmatched routes need their own
// bucket. Test-mode limits come from TEST_MODE_LIMIT_PER_MINUTE above.
export async function createRateLimits(
  options: RateLimitFactoryOptions,
): Promise<RateLimitHandlers> {
  const { logger, isTest, env, redis } = options;

  const client = redis ?? buildStoreClient(env);
  requireProductionClient(isTest, client);

  const reportStoreError = (error: unknown): void => {
    rateLimitStoreErrorsTotal.inc();
    logger.error("rate-limit Redis store error; using local enforcement", {
      phase: "rate-limit",
      error: error instanceof Error ? error.message : String(error),
    });
  };

  client?.on("error", reportStoreError);
  // Injected clients retain their caller-owned connection lifecycle.
  const ownedClient = await connectOwnedClient(redis, client);
  const shutdownRateLimitStore = shutdownFor(ownedClient);

  const storeFor = (bucket: string): Store | undefined =>
    client
      ? new RateLimitDegradedStore(
          redisStoreFor(client, bucket),
          reportStoreError,
        )
      : undefined;

  const baseConfig = buildBaseConfig(logger);
  const limiterFor = (bucket: string, limit: number): RequestHandler => {
    const store = storeFor(bucket);
    return rateLimit({
      ...baseConfig,
      limit: isTest ? TEST_MODE_LIMIT_PER_MINUTE : limit,
      message: bucket,
      ...(store === undefined ? {} : { store }),
    });
  };

  return {
    authLimiter: limiterFor("auth", AUTH_LIMIT_PER_MINUTE),
    trpcLimiter: limiterFor("trpc", TRPC_LIMIT_PER_MINUTE),
    // 60/min/IP covers a page's vitals beacons while capping anonymous abuse.
    vitalsLimiter: limiterFor("vitals", VITALS_LIMIT_PER_MINUTE),
    // Public, Caddy-unmatched ingress: own per-IP bucket caps app.log floods.
    clientLogsLimiter: limiterFor("client-logs", CLIENT_LOGS_LIMIT_PER_MINUTE),
    feedbackLimiter: limiterFor(
      "product-feedback",
      PRODUCT_FEEDBACK_LIMIT_PER_MINUTE,
    ),
    shutdownRateLimitStore,
  };
}
