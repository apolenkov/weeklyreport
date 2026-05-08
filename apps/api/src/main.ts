import 'reflect-metadata';

// 37-01: OTel bootstrap MUST run before any module that imports http /
// express / prisma so the SDK can monkey-patch them. startOtel() is a
// no-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set and OTEL_SDK_DISABLED
// is not 'true'.
import { startOtel } from './infrastructure/otel/otel.bootstrap';
const otelDecision = startOtel();

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { ClsMiddleware, ClsService } from 'nestjs-cls';

import { CorrelationIdMiddleware } from './infrastructure/middleware/correlation-id.middleware';
import * as trpcExpress from '@trpc/server/adapters/express';
import { Queue } from 'bullmq';
import cookieParser from 'cookie-parser';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { createAppRouter } from './infrastructure/trpc/trpc.router';
import { createContextFactory } from './infrastructure/trpc/trpc.context';
import { validateEnv } from './infrastructure/config/env.schema';
import { createAppLogger } from './lib/logger';
import { createAuditLogger } from './lib/audit-logger';
import { mountAuthRoutes } from './modules/auth/auth.routes';
import { createAuthController } from './modules/auth/auth.controller';
import {
  createSamlStrategy,
  createSamlStrategyOptions,
} from './modules/auth/saml.strategy';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { mountBullBoard } from './infrastructure/bullmq/bull-board.module';
import { getBullMQOptions } from './infrastructure/bullmq/bullmq-options';
import { createRateLimits } from './infrastructure/throttler/rate-limit.middleware';
import { httpRequestDurationSeconds } from './infrastructure/metrics/metrics.registry';

import { ReportSectionsService } from './modules/report-sections/report-sections.service';
import { ReviewService } from './modules/review/review.service';
import { PublicationService } from './modules/publication/publication.service';
import { PdfExportService } from './modules/pdf-export/pdf-export.service';
import { AdminService } from './modules/admin/admin.service';
import { RemindersService } from './modules/reminders/reminders.service';
import { CarryOverService } from './modules/carry-over/carry-over.service';
import { ArchiveService } from './modules/archive/archive.service';
import { PeriodService } from './modules/period/period.service';
import { WeeklyReportService } from './modules/weekly-report/weekly-report.service';
import { LeadFormService } from './modules/report-sections/lead-form.service';
import { AnalyticsService } from './modules/analytics/analytics.service';
import { AiService } from './modules/ai/ai.service';
import { SearchService } from './modules/search/search.service';
import { ActivityService } from './modules/activity/activity.service';
import { JobsService } from './modules/admin/jobs.service';

const UUID_SEGMENT_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

function normalizeHttpRoute(path: string): string {
  if (path.startsWith('/pdfs/')) return '/pdfs/:file';
  if (path.startsWith('/auth/')) return '/auth/*';
  if (path.startsWith('/health/')) return path;
  if (path === '/metrics') return '/metrics';
  if (path === '/api/client-logs') return '/api/client-logs';
  return path.replace(UUID_SEGMENT_RE, ':id');
}

async function bootstrap() {
  // AUTH-01 / Phase 32-C M-05: dev-auth fence runs from
  // AppModule.onApplicationBootstrap so every NestFactory.create caller
  // (e2e harness, CLI, this server) is protected uniformly. See
  // app.module.ts.

  const env = validateEnv();

  // Sync Zod-applied defaults back into process.env so legacy callers that
  // still read process.env directly (e.g. pdf-export.service.signPdfExportToken)
  // see the validated/defaulted value instead of undefined.
  process.env['PDF_EXPORT_JWT_SECRET'] ??= env.PDF_EXPORT_JWT_SECRET;

  // We resolve ClsService from the container, so the app must exist first.
  // Pre-Nest output goes to console (no logger available yet).
  console.log('[bootstrap] starting customreport-api');

  const app = await NestFactory.create(AppModule);

  const cls = app.get(ClsService);
  const logger = createAppLogger({
    service: 'customreport-api',
    minLevel: env.LOG_LEVEL,
    logDir: env.LOG_DIR,
    clsService: cls,
  });

  logger.info('bootstrap started');
  // 37-01: log OTel decision for ops visibility (one line, structured).
  if (otelDecision.started) {
    logger.info('otel sdk started', {
      phase: 'otel',
      endpoint: otelDecision.endpoint,
      samplingRatio: otelDecision.samplingRatio,
    });
  } else {
    logger.info('otel sdk disabled', {
      phase: 'otel',
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

  // 36-04: multi-origin whitelist. FRONTEND_URLS (CSV) optionally extends
  // FRONTEND_URL (single). Production env validates no '*' is in the list.
  // CORS reflects the request's origin only when it matches one of the
  // whitelisted entries — wildcard is never allowed.
  const allowedOrigins = (() => {
    const single = env.FRONTEND_URL;
    const csv = env.FRONTEND_URLS
      ? env.FRONTEND_URLS.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return Array.from(new Set([single, ...csv]));
  })();
  logger.info('cors origins configured', {
    phase: 'cors',
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
      if (req.path.startsWith('/trpc')) return nextFn();
      const start = performance.now();
      res.on('finish', () => {
        const duration = Math.round(performance.now() - start);
        // 4xx/5xx → warn so they show up at info-level prod logs;
        // 1xx/2xx/3xx → debug so a quiet endpoint doesn't drown logs.
        const status = res.statusCode;
        const level =
          status >= 500 ? 'error' : status >= 400 ? 'warn' : 'debug';
        logger[level]('http request', {
          phase: 'http.request',
          method: req.method,
          path: req.path,
          status,
          duration,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });
        httpRequestDurationSeconds.observe(
          {
            method: req.method,
            route: normalizeHttpRoute(req.path),
            status_code: String(status),
          },
          duration / 1000,
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
    env.NODE_ENV === 'development' ||
    process.env['CLIENT_LOG_FORWARDING'] === 'true';
  app.use(
    '/api/client-logs',
    express.json({ limit: '128kb' }),
    (req: express.Request, res: express.Response) => {
      if (!clientLogsEnabled) {
        res.sendStatus(204);
        return;
      }
      const body = req.body as { entries?: unknown };
      const entries = Array.isArray(body?.entries) ? body.entries : [];
      for (const raw of entries.slice(0, 100)) {
        if (!raw || typeof raw !== 'object') continue;
        const e = raw as Record<string, unknown>;
        const lvl = e['level'];
        const level: 'debug' | 'info' | 'warn' | 'error' =
          lvl === 'debug' || lvl === 'info' || lvl === 'warn' || lvl === 'error'
            ? lvl
            : 'info';
        const msg =
          typeof e['message'] === 'string'
            ? (e['message'] as string).slice(0, 2000)
            : '<non-string>';
        logger[level](`client: ${msg}`, {
          phase: 'web.client',
          source:
            typeof e['source'] === 'string'
              ? (e['source'] as string).slice(0, 64)
              : undefined,
          url:
            typeof e['url'] === 'string'
              ? (e['url'] as string).slice(0, 500)
              : undefined,
          stack:
            typeof e['stack'] === 'string'
              ? (e['stack'] as string).slice(0, 4000)
              : undefined,
          ts: e['ts'],
          ua: req.get('user-agent')?.slice(0, 200),
          ip: req.ip,
        });
      }
      res.sendStatus(204);
    },
  );

  // NOTIF-06 (Phase 29-05): read-only Queue handle for the admin DLQ count.
  // Constructed once at boot; Express request lifecycle does not need its
  // own connection. Closed on app shutdown via enableShutdownHooks above.
  const emailReminderQueue = new Queue('email-reminder', getBullMQOptions());

  // Phase 35-06: thin wrapper around the email-reminder Queue handle for the
  // admin DLQ admin tab (`/admin?tab=jobs`). Stays out of the NestJS DI graph
  // for the same reason emailReminderQueue does — see the @nestjs/bullmq DI
  // bug note in bullmq.module.ts.
  const jobsService = new JobsService(emailReminderQueue, logger);

  // Resolve all services from NestJS DI container
  const appRouter = createAppRouter({
    prisma: app.get(PrismaService),
    reportSectionsService: app.get(ReportSectionsService),
    reviewService: app.get(ReviewService),
    publicationService: app.get(PublicationService),
    pdfExportService: app.get(PdfExportService),
    adminService: app.get(AdminService),
    remindersService: app.get(RemindersService),
    carryOverService: app.get(CarryOverService),
    archiveService: app.get(ArchiveService),
    periodService: app.get(PeriodService),
    weeklyReportService: app.get(WeeklyReportService),
    leadFormService: app.get(LeadFormService),
    analyticsService: app.get(AnalyticsService),
    aiService: app.get(AiService),
    searchService: app.get(SearchService),
    activityService: app.get(ActivityService),
    emailReminderQueue,
    jobsService,
  });

  // Mount tRPC as Express middleware at /trpc
  const expressApp = app.getHttpAdapter().getInstance();

  // Phase 23-01: serve generated PDF artefacts.
  // The BullMQ worker writes to `pdfDir/{jobId}.pdf` and stores
  // `artifactUrl='/pdfs/{jobId}.pdf'` on the export job row. The frontend
  // calls `window.open(artifactUrl)` once status === 'completed', so this
  // mount must agree with the worker's output dir on an absolute path.
  const pdfDir = resolve(env.PDF_OUTPUT_DIR);
  mkdirSync(pdfDir, { recursive: true });
  expressApp.use(
    '/pdfs',
    express.static(pdfDir, {
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment');
      },
    }),
  );
  logger.info('mounted PDF static serving', { route: '/pdfs', pdfDir });

  // 36-01: rate-limit /trpc with the permissive bucket. The /auth limiter
  // is mounted further down with mountAuthRoutes (it needs to wrap the
  // /auth/* routes the auth module registers).
  const { authLimiter, trpcLimiter } = createRateLimits({
    logger,
    isTest: env.NODE_ENV === 'test' || env.AUTH_DEV_MODE,
  });
  expressApp.use(
    '/trpc',
    trpcLimiter,
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: createContextFactory(app, logger),
    }),
  );

  // Mount SAML auth routes (login, callback, logout, dev-login)
  const prismaService = app.get(PrismaService);
  const samlOptions = createSamlStrategyOptions(process.env);
  const samlStrategy = createSamlStrategy(samlOptions);
  const authCtrl = createAuthController(process.env);
  // AUTH-08 (Phase 29-01): structured audit channel for login-success/fail
  // and logout. Wired here so the same AppLogger drives every audit event.
  const auditLogger = createAuditLogger(logger);
  // 36-01: gate all /auth/* routes behind the strict auth limiter.
  // Express applies middlewares in order, so registering it BEFORE
  // mountAuthRoutes covers every /auth/* route the module mounts.
  // Skip /auth/dev-login — gated by AUTH_DEV_MODE flag (dev-only),
  // not a brute-force surface, and 5/min would block E2E suites.
  expressApp.use('/auth', ((req, res, next) => {
    if (req.path === '/dev-login') return next();
    return authLimiter(req, res, next);
  }) as RequestHandler);
  mountAuthRoutes(
    expressApp,
    samlStrategy,
    authCtrl,
    prismaService,
    process.env,
    auditLogger,
  );

  mountBullBoard(app);

  await app.listen(env.PORT);
  logger.info(`API server listening on port ${env.PORT}`);
}

void bootstrap();
