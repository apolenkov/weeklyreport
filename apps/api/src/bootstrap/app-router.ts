import type { INestApplication } from "@nestjs/common";
import type { Queue } from "bullmq";

import type { EnvConfig } from "../infrastructure/config/env.schema";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import {
  type AppRouter,
  createAppRouter,
} from "../infrastructure/trpc/trpc.router";
import { ActivityService } from "../modules/activity/index.js";
import {
  ActionLogService,
  JobsService,
  PeriodAdminService,
  ProjectAdminService,
  ReminderAdminService,
  ReopenRequestAdminService,
  SessionRevocationService,
  SnapshotAdminService,
} from "../modules/admin/index.js";
import { AnalyticsService } from "../modules/analytics/index.js";
import { ArchiveService } from "../modules/archive/index.js";
import { OrganizationService } from "../modules/organization/index.js";
import { PdfExportService } from "../modules/pdf-export/index.js";
import { PeriodService } from "../modules/period/index.js";
import { ProjectActivityService } from "../modules/project-activity/index.js";
import { PublicationService } from "../modules/publication/index.js";
import { RemindersService } from "../modules/reminders/index.js";
import {
  LeadFormService,
  ReportSectionsService,
} from "../modules/report-sections/index.js";
import {
  ReviewActionsService,
  ReviewService,
} from "../modules/review/index.js";
import { SearchService } from "../modules/search/index.js";
import { TelemetryService } from "../modules/telemetry/index.js";
import { WeeklyReportService } from "../modules/weekly-report/index.js";

// Resolve every tRPC-facing service from the DI container and assemble the app
// router. The cross-cutting primitives built in bootstrap (env, autoCarryOver,
// the queue handles and the DLQ jobs service) are threaded in.
/**
 * Build App Router.
 * @param deps - The deps argument.
 */
export function buildAppRouter(deps: {
  app: INestApplication;
  prisma: PrismaService;
  env: EnvConfig;
  autoCarryOver: (targetReportId: string) => Promise<void>;
  emailReminderQueue: Queue;
  telegramOutboundQueue: Queue;
  jobsService: JobsService;
}): AppRouter {
  const {
    app,
    prisma,
    env,
    autoCarryOver,
    emailReminderQueue,
    telegramOutboundQueue,
    jobsService,
  } = deps;
  return createAppRouter({
    prisma,
    env,
    autoCarryOver,
    reportSectionsService: app.get(ReportSectionsService),
    reviewService: app.get(ReviewService),
    reviewActionsService: app.get(ReviewActionsService),
    publicationService: app.get(PublicationService),
    pdfExportService: app.get(PdfExportService),
    snapshotAdminService: app.get(SnapshotAdminService),
    projectAdminService: app.get(ProjectAdminService),
    reminderAdminService: app.get(ReminderAdminService),
    periodAdminService: app.get(PeriodAdminService),
    reopenRequestAdminService: app.get(ReopenRequestAdminService),
    actionLogService: app.get(ActionLogService),
    // The DI instance shares the Redis revoked set with the context factory's
    // own instance, so a revocation lands where `isUserAccessBarred` reads —
    // without this the deactivate/activate revoked-set fast path is dead code.
    sessionRevocationService: app.get(SessionRevocationService),
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
    telemetryService: app.get(TelemetryService),
  });
}
