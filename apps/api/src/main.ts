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

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import { ClsMiddleware } from "nestjs-cls";
import { AppModule } from "./app.module";
import { buildAppRouter } from "./bootstrap/app-router";
import { createAutoCarryOver } from "./bootstrap/auto-carry-over";
import { createClientLogsHandler } from "./bootstrap/client-logs-handler";
import { resolveAllowedOrigins } from "./bootstrap/cors-origins";
import {
  CLIENT_LOGS_ROUTE,
  createHttpAccessLog,
  PDF_DOWNLOAD_ROUTE,
} from "./bootstrap/http-access-log";
import { createBootstrapJobsService } from "./bootstrap/jobs-service";
import { createProvisionLeadWorkspace } from "./bootstrap/lead-workspace-provisioner";
import { logOtelDecision } from "./bootstrap/otel-decision-log";
import { registerProcessErrorHandlers } from "./bootstrap/process-error-handlers";
import { QueueRegistry } from "./infrastructure/bullmq/queue-registry.js";
import { validateEnv } from "./infrastructure/config/env.schema";
import { SentryExceptionFilter } from "./infrastructure/filters/sentry-exception.filter";
import {
  CLIENT_LOGS_JSON_LIMIT,
  mountClientLogsIngress,
  TRPC_MAX_BODY_BYTES,
} from "./infrastructure/http/ingress-limits";
import { CorrelationIdMiddleware } from "./infrastructure/middleware/correlation-id.middleware";
import { PrismaService } from "./infrastructure/prisma/prisma.service";
import { createRateLimits } from "./infrastructure/throttler/rate-limit.middleware";
import { createContextFactory } from "./infrastructure/trpc/trpc.context";
import { APP_LOGGER, createAuditLogger } from "./lib/audit-logger";
import type { AppLogger } from "./lib/logger";
import { createAppLogger } from "./lib/logger";
import { NestAppLoggerAdapter } from "./lib/nest-app-logger.adapter";
import { SessionRevocationService } from "./modules/admin/index.js";
import {
  createAuthController,
  createSamlStrategy,
  createSamlStrategyOptions,
  hasSamlEnv,
  mountAuthRoutes,
} from "./modules/auth/index.js";
import { mountBullBoard } from "./infrastructure/bullmq/bull-board.module";
import { createPdfDownloadHandler } from "./modules/pdf-export/index.js";

async function bootstrap() {
  // Dev-auth fence is in AppModule.onApplicationBootstrap (all NestFactory callers).
  // validateEnv() exits on missing/invalid required vars; schema has no defaults.
  const env = validateEnv();

  // Pre-bootstrap logger (no CLS yet) routed through NestAppLoggerAdapter so all
  // NestJS Logger(context) calls land in app.log; upgraded once CLS resolves.
  const preBootLogger = createAppLogger({
    service: "customreport-api",
    minLevel: env.LOG_LEVEL,
    logDir: env.LOG_DIR,
  });
  const nestLoggerAdapter = new NestAppLoggerAdapter(preBootLogger);

  preBootLogger.info("bootstrap starting");

  const app = await NestFactory.create(AppModule, {
    logger: nestLoggerAdapter,
  });

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));

  // The single post-CLS AppLogger, resolved from the container so the audit sink
  // and this logger share ONE file sink — no second concurrent writer on app.log.
  const logger = app.get<AppLogger>(APP_LOGGER);

  nestLoggerAdapter.setLogger(logger);
  logger.info("bootstrap started");
  logOtelDecision(logger, otelDecision);

  app.enableShutdownHooks();
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
  // client-logs forwarder below is guarded ahead of its terminating handler;
  // the /trpc and /api/web-vitals limiters are mounted further down.
  const { authLimiter, trpcLimiter, vitalsLimiter, clientLogsLimiter } =
    createRateLimits({
      logger,
      isTest: env.NODE_ENV === "test" || env.AUTH_DEV_MODE,
      env,
    });

  const clientLogsEnabled =
    env.NODE_ENV === "development" || env.CLIENT_LOG_FORWARDING === "true";
  // `trust proxy: 1` (set below) makes req.ip the real client, so the limiter
  // keys per client, not per proxy hop; the mount order lives in the shared helper.
  mountClientLogsIngress(
    app,
    CLIENT_LOGS_ROUTE,
    clientLogsLimiter,
    express.json({ limit: CLIENT_LOGS_JSON_LIMIT }),
    createClientLogsHandler({ logger, enabled: clientLogsEnabled }),
  );

  // Shared queue handles for the admin DLQ count and the Telegram smoke-test.
  // Owned by QueueRegistry — one connection per name, closed on shutdown.
  const queueRegistry = app.get(QueueRegistry);
  const emailReminderQueue = queueRegistry.get("email-reminder");
  const telegramOutboundQueue = queueRegistry.get("telegram-outbound");

  const prismaService = app.get(PrismaService);

  const jobsService = createBootstrapJobsService({
    emailReminderQueue,
    prisma: prismaService,
    logger,
  });

  const autoCarryOver = createAutoCarryOver({
    app,
    prisma: prismaService,
    logger,
  });

  const appRouter = buildAppRouter({
    app,
    prisma: prismaService,
    env,
    autoCarryOver,
    emailReminderQueue,
    telegramOutboundQueue,
    jobsService,
  });

  const expressApp = app.getHttpAdapter().getInstance() as express.Express;

  // Trust exactly one hop (Caddy's X-Forwarded-For). `true` would accept a forged
  // header from any direct caller — safe only while the API host port is closed.
  expressApp.set("trust proxy", 1);

  // Same-origin /pdfs/{jobId}.pdf so the session cookie rides; handler authorizes
  // against the bound report — no unauthenticated path to the bytes.
  const pdfDir = resolve(env.PDF_OUTPUT_DIR);
  mkdirSync(pdfDir, { recursive: true });
  const pdfAuthController = createAuthController(process.env);
  expressApp.get(
    PDF_DOWNLOAD_ROUTE,
    createPdfDownloadHandler({
      prisma: prismaService,
      pdfDir,
      verifySessionToken: (token) =>
        pdfAuthController.verifySessionToken(token),
      sessionRevocation: app.get(SessionRevocationService),
    }),
  );
  logger.info("mounted authenticated PDF download handler", {
    route: PDF_DOWNLOAD_ROUTE,
    pdfDir,
  });

  // `maxBodySize` bounds the tRPC ingress with an explicit, auditable cap so an
  // oversized mutation body is rejected with 413 before the procedure runs.
  expressApp.use(
    "/trpc",
    trpcLimiter,
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: createContextFactory(app, logger),
      maxBodySize: TRPC_MAX_BODY_BYTES,
    }),
  );

  // Bound the public, unauthenticated web-vitals beacon. Registered before
  // app.listen so it runs ahead of the Nest controller handling the beacon.
  expressApp.use("/api/web-vitals", vitalsLimiter);

  // No SAML env → dev-login only (prod fence + mountAuthRoutes refuse boot if
  // both off). Any SAML var present → real strategy; partial set fails via requireEnv.
  const samlStrategy = hasSamlEnv(process.env)
    ? createSamlStrategy(createSamlStrategyOptions(process.env))
    : undefined;
  if (samlStrategy === undefined) {
    logger.warn(
      "SAML env is absent — /auth/saml/* answers 503; dev-login is the only auth path",
    );
  }
  const authCtrl = createAuthController(process.env);
  const auditLogger = createAuditLogger(logger);
  // Auth limiter before mountAuthRoutes so every /auth/* route is covered.
  // Skip /auth/dev-login: AUTH_DEV_MODE-gated, not brute-force; 5/min blocks E2E.
  expressApp.use("/auth", ((req, res, next) => {
    if (req.path === "/dev-login") {
      next();
      return;
    }
    return authLimiter(req, res, next);
  }) as RequestHandler);
  const provisionLeadWorkspace = createProvisionLeadWorkspace({
    app,
    prisma: prismaService,
    autoCarryOver,
  });
  mountAuthRoutes(
    expressApp,
    samlStrategy,
    authCtrl,
    prismaService,
    process.env,
    provisionLeadWorkspace,
    auditLogger,
  );

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
