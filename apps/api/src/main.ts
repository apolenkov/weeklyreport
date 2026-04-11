import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import * as trpcExpress from '@trpc/server/adapters/express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { createAppRouter } from './infrastructure/trpc/trpc.router';
import { createContextFactory } from './infrastructure/trpc/trpc.context';
import { validateEnv } from './infrastructure/config/env.schema';
import { createAppLogger } from './lib/logger';
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

async function bootstrap() {
  const env = validateEnv();
  const logger = createAppLogger({
    service: 'customreport-api',
    minLevel: env.LOG_LEVEL,
    logDir: env.LOG_DIR,
  });

  logger.info('bootstrap started');

  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
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

  // TODO: Re-enable when BullMQ DI issue is resolved
  // mountBullBoard(app);

  await app.listen(env.PORT);
  logger.info(`API server listening on port ${env.PORT}`);
}

void bootstrap();
