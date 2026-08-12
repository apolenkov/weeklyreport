import type { Express } from "express";

import { mountBullBoard } from "../infrastructure/bullmq/bull-board.module.js";
import { validateEnv } from "../infrastructure/config/env.schema.js";
import type { OtelBootstrapResult } from "../infrastructure/otel/otel.bootstrap.js";
import { shutdownOtel } from "../infrastructure/otel/otel.bootstrap.js";
import { mountApiIngress } from "./api-ingress.js";
import { registerApiShutdown } from "./api-shutdown.js";
import { createAppServices } from "./app-services.js";
import { mountAuthIngress } from "./auth-ingress.js";
import { configureHttpPipeline } from "./http-pipeline.js";
import { createNestApp } from "./nest-app.js";
import { registerProcessErrorHandlers } from "./process-error-handlers.js";
import { runtimeShutdownCompletionWriter } from "./runtime-shutdown-completion.js";
import { shutdownSentry } from "./sentry-bootstrap.js";

export async function bootstrapApi(
  otelDecision: OtelBootstrapResult,
): Promise<void> {
  const env = validateEnv();
  const writeCompletion = runtimeShutdownCompletionWriter(
    env.RUNTIME_SWEEP_SHUTDOWN_COMPLETION,
  );
  const { app, logger } = await createNestApp({ env, otelDecision });
  const { authLimiter, trpcLimiter, vitalsLimiter, shutdownRateLimitStore } =
    await configureHttpPipeline({
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
  });
  mountAuthIngress({
    app,
    expressApp,
    logger,
    prisma,
    autoCarryOver,
    authLimiter,
  });
  mountBullBoard(app);
  registerProcessErrorHandlers(logger);

  await app.listen(env.PORT);
  logger.info(`API server listening on port ${env.PORT}`);
  // This coordinator exclusively owns process signals so Nest lifecycle hooks,
  // logs, and telemetry drain exactly once in one observable sequence.
  registerApiShutdown({
    app,
    logger,
    shutdownRateLimitStore,
    shutdownOtel,
    shutdownSentry,
    ...(writeCompletion === undefined ? {} : { writeCompletion }),
  });
}
