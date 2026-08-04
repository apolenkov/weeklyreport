import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";

import type { ActivityService } from "../../modules/activity/index.js";
import type { ActionLogService } from "../../modules/admin/index.js";
import type { JobsService } from "../../modules/admin/index.js";
import type {
  PeriodAdminService,
  ProjectAdminService,
  ReminderAdminService,
  ReopenRequestAdminService,
  SnapshotAdminService,
} from "../../modules/admin/index.js";
import type { SessionRevocationService } from "../../modules/admin/index.js";
import type { AnalyticsService } from "../../modules/analytics/index.js";
import type { ArchiveService } from "../../modules/archive/index.js";
import type { AutoCarryOverOutcome } from "../../modules/carry-over/index.js";
import { OrganizationService } from "../../modules/organization/index.js";
import { PdfExportService } from "../../modules/pdf-export/index.js";
import type { PeriodService } from "../../modules/period/index.js";
import type { ProjectActivityService } from "../../modules/project-activity/index.js";
import { PublicationService } from "../../modules/publication/index.js";
import { RemindersService } from "../../modules/reminders/index.js";
import type { LeadFormService } from "../../modules/report-sections/index.js";
import type { ReportSectionsService } from "../../modules/report-sections/index.js";
import type { ReviewService } from "../../modules/review/index.js";
import type { ReviewActionsService } from "../../modules/review/index.js";
import { type SearchService } from "../../modules/search/index.js";
import type { TelemetryService } from "../../modules/telemetry/index.js";
import type { WeeklyReportService } from "../../modules/weekly-report/index.js";
import type { EnvConfig } from "../config/env.schema";
import { createActivityRouter } from "./routers/activity.router.js";
import { createAdminRouter } from "./routers/admin/admin.router.js";
import { createAnalyticsRouter } from "./routers/analytics.router.js";
import { createArchiveRouter } from "./routers/archive.router.js";
import { createAuthRouter } from "./routers/auth.router.js";
import { createDevRouter } from "./routers/dev.router.js";
import { createLeadFormRouter } from "./routers/lead-form.router.js";
import { createOrganizationRouter } from "./routers/organization.router.js";
import { createPdfExportRouter } from "./routers/pdf-export.router.js";
import { createPeriodRouter } from "./routers/period.router.js";
import { createProjectActivityRouter } from "./routers/project-activity.router.js";
import { createRemindersRouter } from "./routers/reminders.router.js";
import { createReportsRouter } from "./routers/reports.router.js";
import { createReviewRouter } from "./routers/review.router.js";
import { createSearchRouter } from "./routers/search.router.js";
import { createTelemetryRouter } from "./routers/telemetry.router.js";
import { createWeeklyReportRouter } from "./routers/weekly-report.router.js";
import { router } from "./trpc.middleware.js";

export interface AppRouterDeps {
  readonly prisma: PrismaClient;
  // Threaded from main.ts so procedures read the validated env, never raw
  // `process.env`.
  readonly env: EnvConfig;
  readonly reportSectionsService: ReportSectionsService;
  readonly reviewService: ReviewService;
  // Review write surface: rides `leadershipProcedure` (lead excluded), with
  // per-group scope and reviewer designation enforced inside the service.
  // Required: missing wiring must fail loud, never surface empty success.
  readonly reviewActionsService: ReviewActionsService;
  readonly publicationService: PublicationService;
  readonly pdfExportService: PdfExportService;
  readonly snapshotAdminService: SnapshotAdminService;
  readonly projectAdminService: ProjectAdminService;
  readonly reminderAdminService: ReminderAdminService;
  readonly periodAdminService: PeriodAdminService;
  readonly reopenRequestAdminService: ReopenRequestAdminService;
  readonly organizationService: OrganizationService;
  readonly remindersService: RemindersService;
  // Best-effort carry-over for a period minted open; never rejects (a
  // scheduled-born period carries at its scheduled→open flip instead).
  // Optional for role-coverage `{}` deps; main.ts always wires it.
  readonly autoCarryOver?: (
    targetReportId: string,
  ) => Promise<AutoCarryOverOutcome>;
  readonly archiveService: ArchiveService;
  readonly periodService: PeriodService;
  readonly weeklyReportService: WeeklyReportService;
  readonly leadFormService: LeadFormService;
  // Redis prefix invalidation on period publish/reopen.
  readonly analyticsService: AnalyticsService;
  readonly searchService: SearchService;
  readonly activityService: ActivityService;
  // Distinct from activityService (live-status feed under activity.*).
  readonly projectActivityService: ProjectActivityService;
  // Type-optional but runtime-guarded in ops.procedures (fail-loud TRPCError).
  readonly emailReminderQueue?: Queue;
  // Optional with a loud require guard in settings.procedures (never empty-success).
  readonly telegramOutboundQueue?: Queue;
  // Type-optional but runtime-guarded in ops.procedures (fail-loud TRPCError).
  readonly jobsService?: JobsService;
  // Required: missing wiring must fail loud, never fabricate a zero payload.
  readonly telemetryService: TelemetryService;
  // Required: the admin deactivate/activate procedures enforce revocation; a
  // missing service must fail loud, not silently skip the Redis fast path.
  readonly sessionRevocationService: SessionRevocationService;
  // Type-optional but runtime-guarded in ops.procedures (fail-loud TRPCError).
  readonly actionLogService?: ActionLogService;
}

export function createAppRouter(deps: AppRouterDeps) {
  return router({
    auth: createAuthRouter(),
    org: createOrganizationRouter(deps),
    // Only mounted when AUTH_DEV_MODE=true.
    dev: createDevRouter(deps),
    reports: createReportsRouter(deps),
    review: createReviewRouter(deps),
    pdfExport: createPdfExportRouter(deps),
    admin: createAdminRouter(deps),
    archive: createArchiveRouter(deps),
    reminders: createRemindersRouter(deps),
    period: createPeriodRouter(deps),
    weeklyReport: createWeeklyReportRouter(deps),
    leadForm: createLeadFormRouter(deps),
    analytics: createAnalyticsRouter(deps),
    search: createSearchRouter(deps),
    activity: createActivityRouter(deps),
    projectActivity: createProjectActivityRouter(deps),
    telemetry: createTelemetryRouter(deps),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
