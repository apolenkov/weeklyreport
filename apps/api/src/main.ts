/* eslint-disable simple-import-sort/imports -- bootstrap order is load-bearing: `reflect-metadata` MUST be the first executed import for Nest DI metadata, and Sentry.init() MUST run before the OTel bootstrap import (http-module hook order); sorting these imports would break runtime instrumentation. */
import "reflect-metadata";

// Sentry Node SDK init BEFORE OTel (http module hook order).
// Sentry hooks Node's `http` module for error context; OTel also patches it.
// Sentry must run first so its instrumentation wraps the original http, not OTel's wrapper.
import * as Sentry from "@sentry/nestjs";

import { stampActiveTrace } from "./infrastructure/otel/sentry-trace-correlation";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0, // traces via OTel/Tempo, not Sentry
    // Sentry v8+ otherwise installs its OWN global OTel TracerProvider, which
    // wins over the NodeSDK in otel.bootstrap and starves Tempo of spans.
    // Skip it so the NodeSDK owns tracing; Sentry stays error-capture only.
    skipOpenTelemetrySetup: true,
    // Raw process.env, not the validated config: init() runs at module load,
    // before validateEnv(). The fallback is load-bearing — passing undefined
    // makes Sentry apply its own default of "production" and mislabel every
    // event from a boot that is about to fail on the missing variable.
    environment: process.env.NODE_ENV ?? "development",
    // Stamp the active OTel span id so Bugsink links to the Tempo trace.
    // Overrides the random id Sentry pre-fills (beforeSend runs after that fill).
    beforeSend: stampActiveTrace,
    // Bugsink stores errors only — never let a transaction reach it.
    beforeSendTransaction: () => null,
  });
}

// OTel must load before http/express/prisma so the SDK can monkey-patch them.
// startOtel() no-ops unless OTEL_EXPORTER_OTLP_ENDPOINT is set and not disabled.
import { startOtel } from "./infrastructure/otel/otel.bootstrap";

const otelDecision = startOtel();

import type { Express } from "express";
import { mountApiIngress } from "./bootstrap/api-ingress";
import { createAppServices } from "./bootstrap/app-services";
import { mountAuthIngress } from "./bootstrap/auth-ingress";
import { configureHttpPipeline } from "./bootstrap/http-pipeline";
import { createNestApp } from "./bootstrap/nest-app";
import { registerProcessErrorHandlers } from "./bootstrap/process-error-handlers";
import { mountBullBoard } from "./infrastructure/bullmq/bull-board.module";
import { validateEnv } from "./infrastructure/config/env.schema";

async function bootstrap() {
  // Dev-auth fence is in AppModule.onApplicationBootstrap (all NestFactory callers).
  // validateEnv() exits on missing/invalid required vars; schema has no defaults.
  const env = validateEnv();

  const { app, logger } = await createNestApp({ env, otelDecision });

  const { authLimiter, trpcLimiter, vitalsLimiter } = configureHttpPipeline({
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

  // Trust exactly one hop (Caddy's X-Forwarded-For). `true` would accept a forged
  // header from any direct caller — safe only while the API host port is closed.
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
}

// Explicit catch: void bootstrap() relies on unhandled-rejection crash, which
// Sentry's listener (when SENTRY_DSN is set) disables — leaving a zombie process.
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
