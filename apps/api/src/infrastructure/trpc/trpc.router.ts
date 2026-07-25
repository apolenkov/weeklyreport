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
  prisma: PrismaClient;
  /**
   * Validated env, threaded from main.ts. Read for the Telegram
   * configured-check (`integrationsStatus`) and the reseed repo-root override
   * (`dev.wipeAndReseed`) instead of raw `process.env`.
   */
  env: EnvConfig;
  reportSectionsService: ReportSectionsService;
  reviewService: ReviewService;
  /**
   * The review capability's write surface —
   * `review.acknowledge` / `review.comment` / `review.deleteComment` /
   * `review.verdict` / `review.acknowledgements`. All ride `leadershipProcedure`
   * (head + admin + viewer; lead excluded); the per-group scope + reviewer
   * designation are enforced inside the service. Optional so role-coverage test
   * fixtures that build the router with `{}` deps keep compiling.
   */
  reviewActionsService?: ReviewActionsService;
  publicationService: PublicationService;
  pdfExportService: PdfExportService;
  snapshotAdminService: SnapshotAdminService;
  projectAdminService: ProjectAdminService;
  reminderAdminService: ReminderAdminService;
  periodAdminService: PeriodAdminService;
  reopenRequestAdminService: ReopenRequestAdminService;
  organizationService: OrganizationService;
  remindersService: RemindersService;
  /**
   * Best-effort auto carry-over, fired when a manually created period is
   * minted open (a scheduled-born one is carried later, at its
   * scheduled→open flip). Never rejects. Optional so role-coverage test
   * fixtures that build the router with `{}` deps keep compiling —
   * production wiring (main.ts) always provides it.
   */
  autoCarryOver?: (targetReportId: string) => Promise<void>;
  archiveService: ArchiveService;
  periodService: PeriodService;
  weeklyReportService: WeeklyReportService;
  leadFormService: LeadFormService;
  // Redis prefix invalidation on period publish/reopen.
  analyticsService: AnalyticsService;
  searchService: SearchService;
  activityService: ActivityService;
  // Distinct from activityService (live-status feed under activity.*).
  projectActivityService: ProjectActivityService;
  // Optional so test fixtures avoid instantiating Redis.
  emailReminderQueue?: Queue;
  // Optional for role-coverage `{}` deps; undefined → INTERNAL_SERVER_ERROR.
  telegramOutboundQueue?: Queue;
  // Optional for role-coverage `{}` deps; undefined Queue → empty/no-op.
  jobsService?: JobsService;
  // Optional for role-coverage `{}` deps; undefined → procedure hidden.
  telemetryService?: TelemetryService;
  // Optional for role-coverage; undefined → skip Redis, JWT TTL only.
  sessionRevocationService?: SessionRevocationService;
  // Optional for role-coverage; real boot always wires it (ops.procedures).
  actionLogService?: ActionLogService;
}

/**
 * Create App Router.
 * @param deps - The deps argument.
 */
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
