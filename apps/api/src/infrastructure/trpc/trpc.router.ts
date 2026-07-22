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
   * review-acknowledgement: the review capability's write surface —
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
   * lead-report-surface-polish: best-effort auto carry-over, fired
   * when a manually created period is minted open (a scheduled-born one is
   * carried later, at its scheduled→open flip). Never rejects. Optional so
   * role-coverage test fixtures that build the router with `{}` deps keep
   * compiling — production wiring (main.ts) always provides it.
   */
  autoCarryOver?: (targetReportId: string) => Promise<void>;
  archiveService: ArchiveService;
  periodService: PeriodService;
  weeklyReportService: WeeklyReportService;
  leadFormService: LeadFormService;
  /**
   * Analytics surface — traffic light history,
   * lead velocity, period comparison. Cached via Redis with prefix-wide
   * invalidation on PeriodService.publishPeriod / reopenPeriod.
   */
  analyticsService: AnalyticsService;
  /**
   * Full-text search across Item / Risk / Decision
   * / Project. tsvector + GIN, Russian text-search config. Role-gated
   * scope via SearchAuthorizationError → FORBIDDEN.
   */
  searchService: SearchService;
  /**
   * Live activity feed for the head/admin dashboard
   * "Активность за текущий период" panel. One row per lead's section in
   * the open period, with section-level counts + last-edit timestamp.
   * Polled every 15s by the dashboard.
   */
  activityService: ActivityService;
  /**
   * Admin provisioning of Project Activities (stage-less reporting units
   * beside products) — the `projectActivity.*` namespace. Distinct from
   * `activityService` above, which serves the live-status feed under the
   * pre-existing `activity.*` namespace.
   */
  projectActivityService: ProjectActivityService;
  /**
   * Read-only BullMQ Queue handle used by
   * `admin.dlqCount` to surface failed-job count. Optional so existing test
   * fixtures can call createAppRouter(stubDeps) without instantiating Redis.
   */
  emailReminderQueue?: Queue;
  /**
   * BullMQ Queue handle for `telegram-outbound`.
   * Drives the admin smoke-test (`admin.testTelegramSend`) so the wiring
   * (queue → worker → MockTelegramAdapter) is provable without an active
   * bot. Optional so role-coverage fixtures that build the router with
   * `{}` deps stay compiling; when undefined the procedure throws
   * `INTERNAL_SERVER_ERROR` rather than 500-ing on a null deref.
   */
  telegramOutboundQueue?: Queue;
  /**
   * BullMQ DLQ admin surface — `admin.jobs.listFailed` /
   * `admin.jobs.retryFailed`. Optional so test fixtures and the role-coverage
   * harness can build the router with `{}` deps; in that mode the service
   * is constructed locally from an undefined Queue and every call returns
   * an empty/no-op result.
   */
  jobsService?: JobsService;
  /**
   * Product-telemetry surface — `telemetry.summary`
   * returns the leadership-readable KPI bundle (reports submitted, on-time
   * ratio, active leads, late sections, pending reopens, PDF export
   * volume, 4-week sparkline). Optional so role-coverage test fixtures
   * that build the router with `{}` deps stay green; when undefined the
   * procedure is hidden from the surface, not 500-ed.
   */
  telemetryService?: TelemetryService;
  /**
   * Redis-backed session revocation for
   * deactivate/activate user. Optional so existing role-coverage test
   * fixtures that build the router with `{}` deps keep compiling —
   * when undefined the mutations still flip isActive in Prisma but skip
   * the Redis fast-path (sessions expire naturally via JWT TTL).
   */
  sessionRevocationService?: SessionRevocationService;
  /**
   * Queryable in-app mutation-audit history — `admin.actionLog.list`.
   * Optional so role-coverage test fixtures that build the router with `{}`
   * deps stay compiling; a real boot always wires it (see
   * `requireActionLogService` below).
   */
  actionLogService?: ActionLogService;
}

export function createAppRouter(deps: AppRouterDeps) {
  return router({
    // === Auth namespace ===
    auth: createAuthRouter(),

    // === Organization namespace ===
    org: createOrganizationRouter(deps),

    // === Dev namespace (only mounted when AUTH_DEV_MODE=true) ===
    dev: createDevRouter(deps),

    // === Reports namespace ===
    reports: createReportsRouter(deps),

    // === Review namespace ===
    review: createReviewRouter(deps),

    // === PDF Export namespace ===
    pdfExport: createPdfExportRouter(deps),

    // === Admin namespace ===
    admin: createAdminRouter(deps),

    // === Archive namespace ===
    archive: createArchiveRouter(deps),

    // === Reminders namespace ===
    reminders: createRemindersRouter(deps),

    // === Period lifecycle namespace (v4.0) ===
    period: createPeriodRouter(deps),

    // === Weekly Report namespace (v4.0) ===
    weeklyReport: createWeeklyReportRouter(deps),

    // === Lead Form namespace (v4.0) ===
    leadForm: createLeadFormRouter(deps),

    // === Analytics namespace ===
    analytics: createAnalyticsRouter(deps),

    // === Search namespace ===
    search: createSearchRouter(deps),

    // === Activity namespace ===
    activity: createActivityRouter(deps),

    // === Project Activity namespace ===
    projectActivity: createProjectActivityRouter(deps),

    // === Telemetry namespace ===
    telemetry: createTelemetryRouter(deps),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
