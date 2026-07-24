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
    environment: process.env.NODE_ENV ?? "development",
    // correlate-errors-to-traces: stamp the active OTel span's id onto the
    // error so the Bugsink event links to its Tempo trace. Overrides the
    // random id Sentry pre-fills here (beforeSend runs after that fill).
    beforeSend: stampActiveTrace,
    // Bugsink stores errors only — never let a transaction reach it.
    beforeSendTransaction: () => null,
  });
}

// OTel bootstrap MUST run before any module that imports http /
// express / prisma so the SDK can monkey-patch them. startOtel() is a
// no-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set and OTEL_SDK_DISABLED
// is not 'true'.
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
  // The dev-auth fence runs from AppModule.onApplicationBootstrap so every
  // NestFactory.create caller is protected uniformly (see app.module.ts).
  // validateEnv() exits the process on any missing/invalid required var, so past
  // this point every value is present and valid; the schema has no defaults.
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

  // Both middlewares MUST run here (not via NestModule.configure): Nest's
  // MiddlewareConsumer only wraps controller routes, so the raw Express handlers
  // registered below (/trpc, SAML/dev-login) would otherwise see no CLS scope
  // and the logger would fall back to 'no-context' instead of a real request id.
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

  // Caddy is the only edge proxy and sets X-Forwarded-For; trusting exactly one
  // hop makes req.ip the real client IP. Single hop = `1`, not `true` (which
  // would trust a forged header from any direct caller) — safe only while the
  // API is reachable solely through Caddy: the direct API host port must be
  // closed before this is relied on in production.
  expressApp.set("trust proxy", 1);

  // Authenticated, authorized PDF handler. The frontend opens the relative
  // `/pdfs/{jobId}.pdf` same-origin so the session cookie rides along and the
  // handler authorizes the caller against the bound report — no unauthenticated
  // path to the bytes remains on any port.
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

  // No SAML env at all → dev-login-only posture (env.schema's production fence
  // forbids that combination in prod; outside prod the throw inside
  // mountAuthRoutes refuses to boot when dev-login is off too). ANY SAML var
  // present → build the real strategy, where a partial set fails loud via
  // requireEnv naming the missing variable.
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
  // Gate all /auth/* behind the strict auth limiter, registered BEFORE
  // mountAuthRoutes so it covers every route the module mounts. Skip
  // /auth/dev-login — gated by AUTH_DEV_MODE (dev-only), not a brute-force
  // surface, and 5/min would block E2E suites.
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

// A boot-time throw must terminate the process. `void bootstrap()` would rely
// on Node's default unhandled-rejection crash, which any 'unhandledRejection'
// listener (e.g. Sentry's warn-mode integration, installed at module load when
// SENTRY_DSN is set) silently disables — leaving a zombie that never listens
// yet never exits, so a supervisor sees no crash-loop.
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
