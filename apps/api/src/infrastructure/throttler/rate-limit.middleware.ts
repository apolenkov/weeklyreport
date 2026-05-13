import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { RequestHandler } from "express";

import type { AppLogger } from "../../lib/logger";
import { rateLimitHitsTotal } from "../metrics/metrics.registry.js";

/**
 * 36-01 rate-limit middleware factory.
 *
 * Three tiers based on URL prefix:
 *   - /auth/*  → strict (login brute-force protection)
 *   - /trpc/*  → permissive (legitimate query traffic shouldn't trip)
 *   - else     → not limited here (already covered by upstream/edge proxy)
 *
 * Test-mode bumps every bucket to 1000/min so E2E suites that fire
 * 10+ rapid logins in one spec don't flake. Production keeps the
 * documented values (5 / 200 per minute per IP).
 */
export function createRateLimits(options: {
  logger: AppLogger;
  isTest: boolean;
}): {
  authLimiter: RequestHandler;
  trpcLimiter: RequestHandler;
} {
  const { logger, isTest } = options;

  const baseConfig: Partial<Options> = {
    windowMs: 60_000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Use the X-Forwarded-For header when behind a reverse proxy (caddy/nginx).
    // Express's `app.set('trust proxy', 1)` upstream makes this safe.
    //
    // FIX-02 (Phase 35-08): wrap the IP through `ipKeyGenerator` from
    // express-rate-limit so IPv6 addresses are normalised by /64 prefix.
    // Without it, the library emits the ERR_ERL_KEY_GEN_IPV6 advisory
    // every request because varying low bits of an IPv6 address would let
    // a single client bypass the limit by churning suffixes.
    keyGenerator: (req) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
      return ipKeyGenerator(ip);
    },
    handler: (req, res, _next, opts) => {
      const bucket = opts.statusCode === 429 ? String(opts.message) : "unknown";
      logger.warn("rate limit hit", {
        phase: "rate-limit",
        path: req.path,
        ip: req.ip,
        bucket,
      });
      // 37-02: surface to /metrics so the Grafana panel "Rate-limit hits by
      // bucket" has data.
      rateLimitHitsTotal.inc({ bucket });
      res.status(opts.statusCode).json({
        error: "rate_limit_exceeded",
        message: "Too many requests. Please retry shortly.",
        retryAfter: Math.ceil(opts.windowMs / 1000),
      });
    },
  };

  const authLimiter = rateLimit({
    ...baseConfig,
    limit: isTest ? 1000 : 5,
    message: "auth",
  });

  const trpcLimiter = rateLimit({
    ...baseConfig,
    limit: isTest ? 1000 : 200,
    message: "trpc",
  });

  return { authLimiter, trpcLimiter };
}
