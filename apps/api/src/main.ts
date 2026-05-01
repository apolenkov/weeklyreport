import 'reflect-metadata';

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import * as trpcExpress from '@trpc/server/adapters/express';
import { Queue } from 'bullmq';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { createAppRouter } from './infrastructure/trpc/trpc.router';
import { createContextFactory } from './infrastructure/trpc/trpc.context';
import { validateEnv } from './infrastructure/config/env.schema';
import { createAppLogger } from './lib/logger';
import { createAuditLogger } from './lib/audit-logger';
import { mountAuthRoutes } from './modules/auth/auth.routes';
import { createAuthController } from './modules/auth/auth.controller';
import { createSamlStrategy, createSamlStrategyOptions } from './modules/auth/saml.strategy';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { mountBullBoard } from './infrastructure/bullmq/bull-board.module';

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

async function bootstrap() {
  // AUTH-01 / Phase 32-C M-05: dev-auth fence runs from
  // AppModule.onApplicationBootstrap so every NestFactory.create caller
  // (e2e harness, CLI, this server) is protected uniformly. See
  // app.module.ts.

  const env = validateEnv();

  // We resolve ClsService from the container, so the app must exist first.
  // Pre-Nest output goes to console (no logger available yet).
  // eslint-disable-next-line no-console
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

  app.enableShutdownHooks();
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.FRONTEND_URL, credentials: true });

  // HTTP access log — covers everything outside the tRPC adapter:
  // /auth/saml/login, /auth/dev-login, /auth/saml/callback, /auth/logout,
  // /pdfs/*, /health/*, /metrics, /admin/queues. tRPC has its own
  // procedure-level middleware (trpc.middleware.ts) so we skip /trpc/*
  // here to avoid duplicate envelopes for the same request.
  app.use((req: express.Request, res: express.Response, nextFn: express.NextFunction) => {
    if (req.path.startsWith('/trpc')) return nextFn();
    const start = performance.now();
    res.on('finish', () => {
      const duration = Math.round(performance.now() - start);
      // 4xx/5xx → warn so they show up at info-level prod logs;
      // 1xx/2xx/3xx → debug so a quiet endpoint doesn't drown logs.
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'debug';
      logger[level]('http request', {
        phase: 'http.request',
        method: req.method,
        path: req.path,
        status,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    });
    nextFn();
  });

  // NOTIF-06 (Phase 29-05): read-only Queue handle for the admin DLQ count.
  // Constructed once at boot; Express request lifecycle does not need its
  // own connection. Closed on app shutdown via enableShutdownHooks above.
  const emailReminderQueue = new Queue('email-reminder', {
    connection: {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: Number(process.env['REDIS_PORT'] ?? 6379),
      maxRetriesPerRequest: null,
    },
  });

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
    emailReminderQueue,
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

  expressApp.use(
    '/trpc',
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
