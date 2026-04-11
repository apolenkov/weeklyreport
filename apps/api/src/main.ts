import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import * as trpcExpress from '@trpc/server/adapters/express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { createAppRouter } from './infrastructure/trpc/trpc.router.js';
import { createContextFactory } from './infrastructure/trpc/trpc.context.js';
import { validateEnv } from './infrastructure/config/env.schema.js';
import { createAppLogger } from './lib/logger.js';
import { mountAuthRoutes } from './modules/auth/auth.routes.js';
import { createAuthController } from './modules/auth/auth.controller.js';
import { createSamlStrategy, createSamlStrategyOptions } from './modules/auth/saml.strategy.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';

import { ReportSectionsService } from './modules/report-sections/report-sections.service.js';
import { ReviewService } from './modules/review/review.service.js';
import { PublicationService } from './modules/publication/publication.service.js';
import { PdfExportService } from './modules/pdf-export/pdf-export.service.js';
import { AdminService } from './modules/admin/admin.service.js';
import { RemindersService } from './modules/reminders/reminders.service.js';
import { CarryOverService } from './modules/carry-over/carry-over.service.js';
import { ArchiveService } from './modules/archive/archive.service.js';

async function bootstrap() {
  const env = validateEnv();
  const logger = createAppLogger({
    service: 'customreport-api',
    minLevel: env.LOG_LEVEL,
    logDir: env.LOG_DIR,
  });

  logger.info('bootstrap started');

  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.FRONTEND_URL, credentials: true });

  // Resolve all 8 services from NestJS DI container
  const appRouter = createAppRouter({
    reportSectionsService: app.get(ReportSectionsService),
    reviewService: app.get(ReviewService),
    publicationService: app.get(PublicationService),
    pdfExportService: app.get(PdfExportService),
    adminService: app.get(AdminService),
    remindersService: app.get(RemindersService),
    carryOverService: app.get(CarryOverService),
    archiveService: app.get(ArchiveService),
  });

  // Mount tRPC as Express middleware at /trpc
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: createContextFactory(app),
    }),
  );

  // Mount SAML auth routes (login, callback, logout, dev-login)
  const prismaService = app.get(PrismaService);
  const samlOptions = createSamlStrategyOptions(process.env);
  const samlStrategy = createSamlStrategy(samlOptions);
  const authCtrl = createAuthController(process.env);
  mountAuthRoutes(expressApp, samlStrategy, authCtrl, prismaService, process.env);

  app.enableShutdownHooks();

  await app.listen(env.PORT);
  logger.info(`API server listening on port ${env.PORT}`);
}

void bootstrap();
