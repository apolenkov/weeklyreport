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
import { MS_PER_SECOND } from "@customreport/shared";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import { ClsMiddleware } from "nestjs-cls";
import { AppModule } from "./app.module";
import { mountBullBoard } from "./infrastructure/bullmq/bull-board.module";
import { QueueRegistry } from "./infrastructure/bullmq/queue-registry.js";
import { ENV_CONFIG } from "./infrastructure/config/config.module";
import type { EnvConfig } from "./infrastructure/config/env.schema";
import { validateEnv } from "./infrastructure/config/env.schema";
import { SentryExceptionFilter } from "./infrastructure/filters/sentry-exception.filter";
import { httpRequestDurationSeconds } from "./infrastructure/metrics/metrics.registry";
import { CorrelationIdMiddleware } from "./infrastructure/middleware/correlation-id.middleware";
import { PrismaService } from "./infrastructure/prisma/prisma.service";
import { createRateLimits } from "./infrastructure/throttler/rate-limit.middleware";
import { createContextFactory } from "./infrastructure/trpc/trpc.context";
import { createAppRouter } from "./infrastructure/trpc/trpc.router";
import { APP_LOGGER, createAuditLogger } from "./lib/audit-logger";
import type { AppLogger } from "./lib/logger";
import { createAppLogger } from "./lib/logger";
import { NestAppLoggerAdapter } from "./lib/nest-app-logger.adapter";
import { ActivityService } from "./modules/activity/activity.service";
import { AdminService } from "./modules/admin/admin.service";
import { JobsService } from "./modules/admin/jobs.service";
import { SessionRevocationService } from "./modules/admin/session-revocation.service";
import { AnalyticsService } from "./modules/analytics/analytics.service";
import { ArchiveService } from "./modules/archive/archive.service";
import { createAuthController } from "./modules/auth/auth.controller";
import { mountAuthRoutes } from "./modules/auth/auth.routes";
import type { ProvisionLeadWorkspace } from "./modules/auth/user-session";
import {
  createSamlStrategy,
  createSamlStrategyOptions,
} from "./modules/auth/saml.strategy";
import {
  buildAutoCarryOverDeps,
  carryOverIntoOpenedPeriod,
} from "./modules/carry-over/auto-carry-over";
import { CarryOverPrismaRepository } from "./modules/carry-over/carry-over.prisma-repository";
import { CarryOverService } from "./modules/carry-over/carry-over.service";
import { OrganizationService } from "./modules/organization/organization.service";
import { createPdfDownloadHandler } from "./modules/pdf-export/pdf-export.download-handler";
import { PdfExportService } from "./modules/pdf-export/pdf-export.service";
import { ensureCurrentPeriod } from "./modules/period/period-factory";
import { PeriodService } from "./modules/period/period.service";
import { ProjectActivityService } from "./modules/project-activity/project-activity.service";
import { PublicationService } from "./modules/publication/application/publication.service";
import { PolicyApplicatorService } from "./modules/reminders/policy-applicator.service";
import { RemindersService } from "./modules/reminders/reminders.service";
import { ensureLeadSection } from "./modules/report-sections/ensure-lead-section";
import { LeadFormService } from "./modules/report-sections/lead-form.service";
import { ReportSectionsService } from "./modules/report-sections/report-sections.service";
import { ReviewActionsService } from "./modules/review/application/review-actions.service";
import { ReviewService } from "./modules/review/application/review.service";
import { SearchService } from "./modules/search/search.service";
import { TelemetryService } from "./modules/telemetry/telemetry.service";
import { WeeklyReportService } from "./modules/weekly-report/weekly-report.service";

const UUID_SEGMENT_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const HTTP = {
  noContent: 204,
  clientErrorThreshold: 400,
  serverErrorThreshold: 500,
} as const;

// Bounds on the client-log forwarder payload — a misbehaving browser tab
// must not be able to grow one log line without limit.
const MAX_CLIENT_LOG_BATCH_SIZE = 100;
const MAX_CLIENT_LOG_MESSAGE_LENGTH = 2000;
const MAX_CLIENT_LOG_SOURCE_LENGTH = 64;
const MAX_CLIENT_LOG_URL_LENGTH = 500;
const MAX_CLIENT_LOG_STACK_LENGTH = 4000;
const MAX_CLIENT_LOG_USER_AGENT_LENGTH = 200;

const PDF_DOWNLOAD_ROUTE = "/pdfs/:file";
const CLIENT_LOGS_ROUTE = "/api/client-logs";

function normalizeHttpRoute(path: string): string {
  if (path.startsWith("/pdfs/")) return PDF_DOWNLOAD_ROUTE;
  if (path.startsWith("/auth/")) return "/auth/*";
  if (path.startsWith("/health/")) return path;
  if (path === "/metrics") return "/metrics";
  if (path === CLIENT_LOGS_ROUTE) return CLIENT_LOGS_ROUTE;
  return path.replaceAll(UUID_SEGMENT_RE, ":id");
}

async function bootstrap() {
  // The dev-auth fence runs from AppModule.onApplicationBootstrap so every
  // NestFactory.create caller (e2e harness, CLI, this server) is protected
  // uniformly. See app.module.ts.

  // validateEnv() exits the process on any missing/invalid required var, so by
  // this point every value is present and valid. The schema has no defaults —
  // values come from the environment verbatim — so no process.env back-sync is
  // needed for the callers that still read process.env directly.
  const env = validateEnv();

  // Pre-bootstrap logger (no CLS yet) routed through NestAppLoggerAdapter
  // so all NestJS Logger(context) calls in services/schedulers land in app.log.
  // After CLS is resolved, the adapter is upgraded to the CLS-aware instance.
  const preBootLogger = createAppLogger({
    service: "customreport-api",
    minLevel: env.LOG_LEVEL,
    logDir: env.LOG_DIR,
  });
  const nestLoggerAdapter = new NestAppLoggerAdapter(preBootLogger);

  console.log("[bootstrap] starting customreport-api");

  const app = await NestFactory.create(AppModule, {
    logger: nestLoggerAdapter,
  });

  // Global Sentry exception filter — captures 5xx and non-HTTP errors.
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));

  // The validated env, resolved through the DI container so every Redis
  // connection built at bootstrap (BullMQ queue handles, the PDF-handler and
  // context-factory session-revocation clients) uses the centralized options.
  const envConfig = app.get<EnvConfig>(ENV_CONFIG);
  // The single post-CLS AppLogger, resolved from the container (config.module)
  // so the audit sink (AUDIT_LOGGER) and this logger share ONE file sink —
  // no second concurrent writer on app.log.
  const logger = app.get<AppLogger>(APP_LOGGER);

  nestLoggerAdapter.setLogger(logger);
  logger.info("bootstrap started");
  // Log OTel decision for ops visibility (one line, structured).
  if (otelDecision.started) {
    logger.info("otel sdk started", {
      phase: "otel",
      endpoint: otelDecision.endpoint,
      samplingRatio: otelDecision.samplingRatio,
    });
  } else {
    logger.info("otel sdk disabled", {
      phase: "otel",
      reason: otelDecision.reason,
    });
  }

  app.enableShutdownHooks();
  app.use(helmet());
  app.use(cookieParser());

  // Open the AsyncLocalStorage scope for every Express handler — including
  // the raw `expressApp.use('/trpc', ...)` registered later in this file
  // and the SAML/dev-login routes mounted by mountAuthRoutes(). Then write
  // the request id into the active store so the logger reads a real UUID
  // via cls.get('correlationId') on every emit. Both middlewares MUST run
  // here (not via NestModule.configure) — Nest's MiddlewareConsumer only
  // wraps controller routes, so raw Express handlers would otherwise see
  // no scope and fall back to 'no-context'.
  app.use(new ClsMiddleware({ generateId: false, saveReq: false }).use);
  const correlationIdMiddleware = app.get(CorrelationIdMiddleware);
  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));

  // Multi-origin whitelist. FRONTEND_URLS (CSV) optionally extends
  // FRONTEND_URL (single). Production env validates no '*' is in the list.
  // CORS reflects the request's origin only when it matches one of the
  // whitelisted entries — wildcard is never allowed.
  const allowedOrigins = (() => {
    const single = env.FRONTEND_URL;
    const csv = env.FRONTEND_URLS
      ? env.FRONTEND_URLS.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return Array.from(new Set([single, ...csv]));
  })();
  logger.info("cors origins configured", {
    phase: "cors",
    count: allowedOrigins.length,
    origins: allowedOrigins,
  });
  app.enableCors({ origin: allowedOrigins, credentials: true });

  // HTTP access log — covers everything outside the tRPC adapter:
  // /auth/saml/login, /auth/dev-login, /auth/saml/callback, /auth/logout,
  // /pdfs/*, /health/*, /metrics, /admin/queues. tRPC has its own
  // procedure-level middleware (trpc.middleware.ts) so we skip /trpc/*
  // here to avoid duplicate envelopes for the same request.
  app.use(
    (
      req: express.Request,
      res: express.Response,
      nextFn: express.NextFunction,
    ) => {
      if (req.path.startsWith("/trpc")) {
        nextFn();
        return;
      }
      const start = performance.now();
      res.on("finish", () => {
        const duration = Math.round(performance.now() - start);
        // 4xx/5xx → warn/error so they show up at info-level prod logs;
        // 2xx/3xx health/readiness/liveness → debug (high-frequency, low signal);
        // other 2xx/3xx → info so successful non-tRPC requests are visible in prod.
        const status = res.statusCode;
        const isHealthPath =
          req.path === "/health" || req.path.startsWith("/health/");
        const level =
          status >= HTTP.serverErrorThreshold
            ? "error"
            : status >= HTTP.clientErrorThreshold
              ? "warn"
              : isHealthPath
                ? "debug"
                : "info";
        logger[level]("http request", {
          phase: "http.request",
          method: req.method,
          path: req.path,
          status,
          duration,
          ip: req.ip,
          userAgent: req.get("user-agent"),
        });
        httpRequestDurationSeconds.observe(
          {
            method: req.method,
            route: normalizeHttpRoute(req.path),
            status_code: String(status),
          },
          duration / MS_PER_SECOND,
        );
      });
      nextFn();
    },
  );

  // Browser → server log forwarder. Captures console.error/warn,
  // window.onerror, unhandledrejection from the web app and writes them to
  // the same rotating app.log so all debug data lives in one file.
  // Dev-only by default; turn on in prod with CLIENT_LOG_FORWARDING=true.
  const clientLogsEnabled =
    env.NODE_ENV === "development" || env.CLIENT_LOG_FORWARDING === "true";
  app.use(
    CLIENT_LOGS_ROUTE,
    express.json({ limit: "128kb" }),
    (req: express.Request, res: express.Response) => {
      if (!clientLogsEnabled) {
        res.sendStatus(HTTP.noContent);
        return;
      }
      const body = req.body as { entries?: unknown };
      const entries = Array.isArray(body.entries) ? body.entries : [];
      for (const raw of entries.slice(0, MAX_CLIENT_LOG_BATCH_SIZE)) {
        if (!raw || typeof raw !== "object") continue;
        const e = raw as Record<string, unknown>;
        const lvl = e.level;
        const level: "debug" | "info" | "warn" | "error" =
          lvl === "debug" || lvl === "info" || lvl === "warn" || lvl === "error"
            ? lvl
            : "info";
        const msg =
          typeof e.message === "string"
            ? e.message.slice(0, MAX_CLIENT_LOG_MESSAGE_LENGTH)
            : "<non-string>";
        logger[level](`client: ${msg}`, {
          phase: "web.client",
          source:
            typeof e.source === "string"
              ? e.source.slice(0, MAX_CLIENT_LOG_SOURCE_LENGTH)
              : undefined,
          url:
            typeof e.url === "string"
              ? e.url.slice(0, MAX_CLIENT_LOG_URL_LENGTH)
              : undefined,
          stack:
            typeof e.stack === "string"
              ? e.stack.slice(0, MAX_CLIENT_LOG_STACK_LENGTH)
              : undefined,
          ts: e.ts,
          ua: req.get("user-agent")?.slice(0, MAX_CLIENT_LOG_USER_AGENT_LENGTH),
          ip: req.ip,
        });
      }
      res.sendStatus(HTTP.noContent);
    },
  );

  // Shared queue handles for the admin DLQ count and the Telegram smoke-test
  // (`admin.testTelegramSend`). Owned by QueueRegistry — one connection per
  // name, closed on shutdown — instead of a bootstrap-local `new Queue`.
  const queueRegistry = app.get(QueueRegistry);
  const emailReminderQueue = queueRegistry.get("email-reminder");
  const telegramOutboundQueue = queueRegistry.get("telegram-outbound");

  const prismaService = app.get(PrismaService);

  // Thin wrapper around the email-reminder Queue handle for the
  // admin DLQ admin tab (`/admin?tab=jobs`). Stays out of the NestJS DI graph
  // for the same reason emailReminderQueue does — see the @nestjs/bullmq DI
  // bug note in bullmq.module.ts.
  const jobsService = new JobsService(emailReminderQueue, logger, {
    reminderExecutionExists: async (executionId) => {
      const execution = await prismaService.reminderExecution.findUnique({
        where: { id: executionId },
        select: { id: true },
      });
      return execution !== null;
    },
  });

  // Auto carry-over closure shared by the tRPC createPeriodManual seam and the
  // login provisioning seam below. Best effort by construction —
  // carryOverIntoOpenedPeriod never rejects.
  const autoCarryOverDeps = buildAutoCarryOverDeps({
    prisma: prismaService,
    repository: app.get(CarryOverPrismaRepository),
    carryOverService: app.get(CarryOverService),
    logger,
  });
  const autoCarryOver = (targetReportId: string) =>
    carryOverIntoOpenedPeriod(autoCarryOverDeps, targetReportId);

  // Resolve all services from NestJS DI container
  const appRouter = createAppRouter({
    prisma: prismaService,
    env,
    autoCarryOver,
    reportSectionsService: app.get(ReportSectionsService),
    reviewService: app.get(ReviewService),
    reviewActionsService: app.get(ReviewActionsService),
    publicationService: app.get(PublicationService),
    pdfExportService: app.get(PdfExportService),
    adminService: app.get(AdminService),
    organizationService: app.get(OrganizationService),
    remindersService: app.get(RemindersService),
    archiveService: app.get(ArchiveService),
    periodService: app.get(PeriodService),
    weeklyReportService: app.get(WeeklyReportService),
    leadFormService: app.get(LeadFormService),
    analyticsService: app.get(AnalyticsService),
    searchService: app.get(SearchService),
    activityService: app.get(ActivityService),
    projectActivityService: app.get(ProjectActivityService),
    emailReminderQueue,
    telegramOutboundQueue,
    jobsService,
    // telemetry.summary backend.
    telemetryService: app.get(TelemetryService),
  });

  // Mount tRPC as Express middleware at /trpc
  const expressApp = app.getHttpAdapter().getInstance() as express.Express;

  // Caddy is the only edge proxy and sets X-Forwarded-For; trusting exactly one
  // hop makes req.ip the real client IP (for the auth rate-limit key, audit, and
  // access logs) instead of the Caddy container address. Single hop = `1`, not
  // `true` (which would trust a forged header from any direct caller). Safe only
  // while the API is reachable solely through Caddy — the direct API host port
  // must be closed before this is relied on in production.
  expressApp.set("trust proxy", 1);

  // Serve generated PDF artefacts through an authenticated, authorized handler.
  // The BullMQ worker writes `pdfDir/{jobId}.pdf` and stores
  // `filePath='/pdfs/{jobId}.pdf'` on the export job; the frontend opens that
  // relative URL same-origin, so the ambient `customreport_session` cookie
  // rides along and the handler authorizes the caller against the bound report.
  // This replaces the former unauthenticated `express.static('/pdfs')` mount —
  // removing it closes the artifact-bypass on the direct host port too, since
  // no unauthenticated path to the bytes remains on any port.
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
      sessionRevocation: new SessionRevocationService(undefined, envConfig),
    }),
  );
  logger.info("mounted authenticated PDF download handler", {
    route: PDF_DOWNLOAD_ROUTE,
    pdfDir,
  });

  // Rate-limit /trpc with the permissive bucket. The /auth limiter
  // is mounted further down with mountAuthRoutes (it needs to wrap the
  // /auth/* routes the auth module registers).
  const { authLimiter, trpcLimiter, vitalsLimiter } = createRateLimits({
    logger,
    isTest: env.NODE_ENV === "test" || env.AUTH_DEV_MODE,
  });
  expressApp.use(
    "/trpc",
    trpcLimiter,
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: createContextFactory(app, logger),
    }),
  );

  // Bound the public, unauthenticated web-vitals beacon. `trust proxy: 1` is set
  // above, so req.ip resolves to the real client behind Caddy and this limiter
  // keys per client, not per proxy hop. Registered before app.listen so it runs
  // ahead of the Nest controller handling POST /api/web-vitals.
  expressApp.use("/api/web-vitals", vitalsLimiter);

  // Mount SAML auth routes (login, callback, logout, dev-login)
  const samlOptions = createSamlStrategyOptions(process.env);
  const samlStrategy = createSamlStrategy(samlOptions);
  const authCtrl = createAuthController(process.env);
  // Structured audit channel for login-success/fail
  // and logout. Wired here so the same AppLogger drives every audit event.
  const auditLogger = createAuditLogger(logger);
  // Gate all /auth/* routes behind the strict auth limiter.
  // Express applies middlewares in order, so registering it BEFORE
  // mountAuthRoutes covers every /auth/* route the module mounts.
  // Skip /auth/dev-login — gated by AUTH_DEV_MODE flag (dev-only),
  // not a brute-force surface, and 5/min would block E2E suites.
  expressApp.use("/auth", ((req, res, next) => {
    if (req.path === "/dev-login") {
      next();
      return;
    }
    return authLimiter(req, res, next);
  }) as RequestHandler);
  // The auth module delegates lead-workspace provisioning to the period +
  // report-section domains. Compose them here in the composition root:
  // settings are read PER CALL so admin changes propagate to newly-created
  // periods.
  const policyApplicator = app.get(PolicyApplicatorService);
  const adminService = app.get(AdminService);
  const provisionLeadWorkspace: ProvisionLeadWorkspace = async (userId) => {
    const settings = await adminService.getSettings();
    const now = new Date();
    const { reportId } = await ensureCurrentPeriod(
      prismaService,
      now,
      now,
      settings,
      policyApplicator,
    );
    const { sectionId } = await ensureLeadSection(
      prismaService,
      reportId,
      userId,
    );
    // Unconditional, not gated on "just created" — the execution-dedupe
    // short-circuit makes an already-carried period a single indexed read, so
    // every login doubles as a free retry after a transient carry failure.
    // Never rejects; a carry problem must not block login.
    await autoCarryOver(reportId);
    return { reportId, sectionId };
  };
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

  process.on("uncaughtException", (err) => {
    logger.error("uncaught exception", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled rejection", {
      reason:
        reason instanceof Error
          ? { name: reason.name, message: reason.message, stack: reason.stack }
          : String(reason),
    });
  });

  await app.listen(env.PORT);
  logger.info(`API server listening on port ${env.PORT}`);
}

void bootstrap();
