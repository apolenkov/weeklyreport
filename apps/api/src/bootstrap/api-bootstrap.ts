import type { INestApplication } from "@nestjs/common";
import type { Express } from "express";

import { mountBullBoard } from "../infrastructure/bullmq/bull-board.module.js";
import type { EnvConfig } from "../infrastructure/config/env.schema.js";
import { validateEnv } from "../infrastructure/config/env.schema.js";
import type { OtelBootstrapResult } from "../infrastructure/otel/otel.bootstrap.js";
import { shutdownOtel } from "../infrastructure/otel/otel.bootstrap.js";
import type { AppLogger } from "../lib/logger.js";
import { mountApiIngress } from "./api-ingress.js";
import { registerApiShutdown, shutdownApi } from "./api-shutdown.js";
import { createAppServices } from "./app-services.js";
import { mountAuthIngress } from "./auth-ingress.js";
import { configureHttpPipeline } from "./http-pipeline.js";
import { createNestApp } from "./nest-app.js";
import { registerProcessErrorHandlers } from "./process-error-handlers.js";
import { shutdownSentry } from "./sentry-bootstrap.js";
import type { ShutdownCoordinator } from "./shutdown-coordinator.js";
import { createShutdownCoordinator } from "./shutdown-coordinator.js";

// Before the container logger exists the drain still needs an AppLogger for
// its barrier line; stderr keeps the event without claiming a file sink.
const preLoggerShutdownLogger: AppLogger = {
  debug: () => undefined,
  info: (message) => process.stderr.write(`${message}\n`),
  warn: (message) => process.stderr.write(`${message}\n`),
  error: (message) => process.stderr.write(`${message}\n`),
  child: () => preLoggerShutdownLogger,
};

interface OwnedResources {
  app: Pick<INestApplication, "close">;
  logger: AppLogger;
  shutdownRateLimitStore: () => Promise<void>;
}

interface StartupStagesDeps {
  env: EnvConfig;
  otelDecision: OtelBootstrapResult;
  owned: OwnedResources;
  shutdown: ShutdownCoordinator;
  shutdownRequested: () => boolean;
}

const runStartupStages = async (deps: StartupStagesDeps): Promise<void> => {
  const { env, otelDecision, owned, shutdown, shutdownRequested } = deps;
  const { app, logger } = await createNestApp({ env, otelDecision });
  if (shutdownRequested()) {
    // The drain ran with the no-op closer while the Nest app was being
    // built; close this orphan exactly once and stop.
    await app.close().catch(() => undefined);
    return;
  }
  owned.app = app;
  owned.logger = logger;
  registerProcessErrorHandlers(logger, shutdown);

  const {
    authLimiter,
    trpcLimiter,
    vitalsLimiter,
    feedbackLimiter,
    shutdownRateLimitStore,
  } = await configureHttpPipeline({ app, env, logger });
  if (shutdownRequested()) {
    // Same race one stage later: drain already ran the no-op closer.
    await shutdownRateLimitStore().catch(() => undefined);
    return;
  }
  owned.shutdownRateLimitStore = shutdownRateLimitStore;

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

  await app.listen(env.PORT, env.API_HOST);
  if (shutdownRequested()) return;
  logger.info(`API server listening on ${env.API_HOST}:${env.PORT}`);
};

export async function bootstrapApi(
  otelDecision: OtelBootstrapResult,
): Promise<void> {
  const env = validateEnv();

  // The coordinator exists before the first async acquisition stage so a
  // signal or fatal failure anywhere below drains exactly what has been
  // acquired so far — never twice. Unacquired resources keep no-op closers;
  // acquired ones are armed in place.
  const owned: OwnedResources = {
    app: { close: () => Promise.resolve() },
    logger: preLoggerShutdownLogger,
    shutdownRateLimitStore: () => Promise.resolve(),
  };
  const shutdown = createShutdownCoordinator(() =>
    shutdownApi({
      app: owned.app,
      logger: owned.logger,
      shutdownRateLimitStore: () => owned.shutdownRateLimitStore(),
      shutdownOtel,
      shutdownSentry,
    }),
  );
  // startup.aborted lets pending startup stages notice a drain already
  // requested: no "listening" log, no success path, no double registration.
  const startup = { aborted: false };
  const guardedShutdown: ShutdownCoordinator = {
    request: (cause) => {
      startup.aborted = true;
      shutdown.request(cause);
    },
  };
  registerApiShutdown(guardedShutdown);

  try {
    await runStartupStages({
      env,
      otelDecision,
      owned,
      shutdown: guardedShutdown,
      shutdownRequested: () => startup.aborted,
    });
  } catch (error) {
    // The coordinator owns the exit now: record the original failure once,
    // then request the fatal drain over whatever was acquired so far.
    try {
      owned.logger.error("API bootstrap failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // Even the fallback logger may fail — the coordinator still drains.
    }
    guardedShutdown.request("fatal");
  }
}
