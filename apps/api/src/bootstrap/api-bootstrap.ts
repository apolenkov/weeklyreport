import type { Express } from "express";

import { mountBullBoard } from "../infrastructure/bullmq/bull-board.module.js";
import { validateEnv } from "../infrastructure/config/env.schema.js";
import type { OtelBootstrapResult } from "../infrastructure/otel/otel.bootstrap.js";
import { shutdownOtel } from "../infrastructure/otel/otel.bootstrap.js";
import { mountApiIngress } from "./api-ingress.js";
import { registerApiShutdown, shutdownApi } from "./api-shutdown.js";
import { createAppServices } from "./app-services.js";
import { mountAuthIngress } from "./auth-ingress.js";
import { configureHttpPipeline } from "./http-pipeline.js";
import { createNestApp } from "./nest-app.js";
import { registerProcessErrorHandlers } from "./process-error-handlers.js";
import { shutdownSentry } from "./sentry-bootstrap.js";
import { createShutdownCoordinator } from "./shutdown-coordinator.js";

export async function bootstrapApi(
  otelDecision: OtelBootstrapResult,
): Promise<void> {
  const env = validateEnv();
  const { app, logger } = await createNestApp({ env, otelDecision });
  const {
    authLimiter,
    trpcLimiter,
    vitalsLimiter,
    feedbackLimiter,
    shutdownRateLimitStore,
  } = await configureHttpPipeline({
    app,
    env,
    logger,
  });
  const { prisma, autoCarryOver, appRouter } = createAppServices({
    app,
    env,
    logger,
  });
  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.set("trust proxy", 1);
  mountApiIngress({
    app,
    expressApp,
    env,
    logger,
    prisma,
    appRouter,
    trpcLimiter,
    vitalsLimiter,
    feedbackLimiter,
  });
  mountAuthIngress({
    app,
    expressApp,
    logger,
    prisma,
    autoCarryOver,
    authLimiter,
  });
  mountBullBoard(app, env);
  const shutdownDependencies = {
    app,
    logger,
    shutdownRateLimitStore,
    shutdownOtel,
    shutdownSentry,
  };
  const shutdown = createShutdownCoordinator(() =>
    shutdownApi(shutdownDependencies),
  );
  registerProcessErrorHandlers(logger, shutdown);
  await app.listen(env.PORT, env.API_HOST);
  logger.info(`API server listening on ${env.API_HOST}:${env.PORT}`);
  registerApiShutdown(shutdown);
}
