import type { Express } from "express";

import { mountBullBoard } from "../infrastructure/bullmq/bull-board.module.js";
import { validateEnv } from "../infrastructure/config/env.schema.js";
import type { OtelBootstrapResult } from "../infrastructure/otel/otel.bootstrap.js";
import { mountApiIngress } from "./api-ingress.js";
import { createAppServices } from "./app-services.js";
import { mountAuthIngress } from "./auth-ingress.js";
import { configureHttpPipeline } from "./http-pipeline.js";
import { createNestApp } from "./nest-app.js";
import { registerProcessErrorHandlers } from "./process-error-handlers.js";

const FLUSH_TIMEOUT_MS = 1000;

export async function bootstrapApi(
  otelDecision: OtelBootstrapResult,
): Promise<void> {
  const env = validateEnv();
  const { app, logger } = await createNestApp({ env, otelDecision });
  const { authLimiter, trpcLimiter, vitalsLimiter } =
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
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void Promise.race([
        logger.flush?.(),
        new Promise((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS).unref()),
      ]);
    });
  }
}
