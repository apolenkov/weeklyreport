import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import { ClsMiddleware } from "nestjs-cls";

import type { EnvConfig } from "../infrastructure/config/env.schema";
import {
  CLIENT_LOGS_JSON_LIMIT,
  mountClientLogsIngress,
} from "../infrastructure/http/ingress-limits";
import { CorrelationIdMiddleware } from "../infrastructure/middleware/correlation-id.middleware";
import { createRateLimits } from "../infrastructure/throttler/rate-limit.middleware";
import type { AppLogger } from "../lib/logger";
import { createClientLogsHandler } from "./client-logs-handler";
import { resolveAllowedOrigins } from "./cors-origins";
import { CLIENT_LOGS_ROUTE, createHttpAccessLog } from "./http-access-log";

// The limiters the caller still has to mount itself, on ingress surfaces that
// are only reachable once the Express instance and the tRPC router exist.
export interface DeferredIngressLimiters {
  readonly authLimiter: RequestHandler;
  readonly trpcLimiter: RequestHandler;
  readonly vitalsLimiter: RequestHandler;
}

export async function configureHttpPipeline(deps: {
  app: INestApplication;
  env: EnvConfig;
  logger: AppLogger;
}): Promise<DeferredIngressLimiters> {
  const { app, env, logger } = deps;

  app.use(helmet());
  app.use(cookieParser());

  // Must run here, not NestModule.configure: MiddlewareConsumer skips raw Express
  // handlers (/trpc, SAML), so without this CLS would fall back to 'no-context'.
  app.use(new ClsMiddleware({ generateId: false, saveReq: false }).use);
  const correlationIdMiddleware = app.get(CorrelationIdMiddleware);
  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));

  const allowedOrigins = resolveAllowedOrigins(env);
  logger.info("cors origins configured", {
    phase: "cors",
    count: allowedOrigins.length,
    origins: allowedOrigins,
  });
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.use(createHttpAccessLog(logger));

  // Per-IP limiters for every public ingress surface. Built once here so the
  // client-logs forwarder below is guarded ahead of its terminating handler.
  const { authLimiter, trpcLimiter, vitalsLimiter, clientLogsLimiter } =
    await createRateLimits({
      logger,
      isTest: env.NODE_ENV === "test" || env.AUTH_DEV_MODE,
      env,
    });

  const clientLogsEnabled =
    env.NODE_ENV === "development" || env.CLIENT_LOG_FORWARDING === "true";
  // `trust proxy: 1` (set by the caller) makes req.ip the real client, so the
  // limiter keys per client, not per proxy hop; mount order lives in the helper.
  mountClientLogsIngress(
    app,
    CLIENT_LOGS_ROUTE,
    clientLogsLimiter,
    express.json({ limit: CLIENT_LOGS_JSON_LIMIT }),
    createClientLogsHandler({ logger, enabled: clientLogsEnabled }),
  );

  return { authLimiter, trpcLimiter, vitalsLimiter };
}
