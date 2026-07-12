import { MS_PER_SECOND } from "@customreport/shared";
import type { RequestHandler } from "express";
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";

import type { AppLogger } from "../../lib/logger";
import { rateLimitHitsTotal } from "../metrics/metrics.registry.js";

const HTTP_TOO_MANY_REQUESTS = 429;
// Test-mode bumps every bucket to this figure so E2E suites firing 10+ rapid
// requests per spec don't flake on the production limits below.
const TEST_MODE_LIMIT_PER_MINUTE = 1000;
const AUTH_LIMIT_PER_MINUTE = 5;
const TRPC_LIMIT_PER_MINUTE = 200;
const VITALS_LIMIT_PER_MINUTE = 60;
const CLIENT_LOGS_LIMIT_PER_MINUTE = 60;

/**
 * Rate-limit middleware factory.
 *
 * Tiers based on URL prefix:
 *   - /auth/*           → strict (login brute-force protection)
 *   - /trpc/*           → permissive (legitimate query traffic shouldn't trip)
 *   - /api/web-vitals   → moderate (bounds the public, unauthenticated beacon)
 *   - /api/client-logs  → moderate (bounds the public, unauthenticated log forwarder)
 *   - else              → not limited here
 *
 * Every public ingress surface is keyed per IP by a limiter built here; a route
 * the Caddyfile does not match gets no edge-proxy mitigation, so it must carry
 * its own bucket rather than rely on the proxy.
 *
 * Test-mode bumps every bucket to 1000/min so E2E suites that fire
 * 10+ rapid logins in one spec don't flake. Production keeps the
 * documented values (5 / 200 / 60 / 60 per minute per IP).
 */
export function createRateLimits(options: {
  logger: AppLogger;
  isTest: boolean;
}): {
  authLimiter: RequestHandler;
  trpcLimiter: RequestHandler;
  vitalsLimiter: RequestHandler;
  clientLogsLimiter: RequestHandler;
} {
  const { logger, isTest } = options;

  const baseConfig: Partial<Options> = {
    windowMs: 60_000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Wrap the IP through `ipKeyGenerator` from
    // express-rate-limit so IPv6 addresses are normalised by /64 prefix.
    // Without it, the library emits the ERR_ERL_KEY_GEN_IPV6 advisory
    // every request because varying low bits of an IPv6 address would let
    // a single client bypass the limit by churning suffixes.
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

  const authLimiter = rateLimit({
    ...baseConfig,
    limit: isTest ? TEST_MODE_LIMIT_PER_MINUTE : AUTH_LIMIT_PER_MINUTE,
    message: "auth",
  });

  const trpcLimiter = rateLimit({
    ...baseConfig,
    limit: isTest ? TEST_MODE_LIMIT_PER_MINUTE : TRPC_LIMIT_PER_MINUTE,
    message: "trpc",
  });

  // A real page emits a handful of vitals per navigation; 60/min/IP comfortably
  // covers legitimate beacons while capping anonymous abuse. Shares the
  // rateLimitHitsTotal accounting via the "vitals" bucket message.
  const vitalsLimiter = rateLimit({
    ...baseConfig,
    limit: isTest ? TEST_MODE_LIMIT_PER_MINUTE : VITALS_LIMIT_PER_MINUTE,
    message: "vitals",
  });

  // The client-log forwarder is a public, unauthenticated ingress the Caddyfile
  // does not match, so it carries its own per-IP bucket. A page emits a small
  // bounded burst of log batches; 60/min/IP covers that and caps a log-flood
  // against the shared app.log. Shares rateLimitHitsTotal via "client-logs".
  const clientLogsLimiter = rateLimit({
    ...baseConfig,
    limit: isTest ? TEST_MODE_LIMIT_PER_MINUTE : CLIENT_LOGS_LIMIT_PER_MINUTE,
    message: "client-logs",
  });

  return { authLimiter, trpcLimiter, vitalsLimiter, clientLogsLimiter };
}
