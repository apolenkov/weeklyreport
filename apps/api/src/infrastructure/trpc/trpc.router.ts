import {
  adminCreatePeriodManualSchema,
  adminProjectSchema,
  adminReminderRuleSchema,
  adminTestTelegramSendSchema,
  adminUpdatePeriodManualSchema,
  adminUserSchema,
  appSettingsUpdateSchema,
  compiledHistoryInputSchema,
  compiledHistoryResultSchema,
  DEFAULT_ORGANIZATION_IDENTITY,
  draftSaveSchema,
  groupProductEdgeInputSchema,
  latestForViewerReportSchema,
  leadVelocityInputSchema,
  MS_PER_MINUTE,
  myHistoryEntrySchema,
  organizationUpdateSchema,
  paginationInputSchema,
  periodComparisonInputSchema,
  periodListBucketSchema,
  projectActivityArchiveSchema,
  projectActivityCreateSchema,
  projectActivityLeadEdgeSchema,
  projectActivityUpdateSchema,
  queueNameSchema,
  reminderPolicySchema,
  reportingGroupSchema,
  reportPeriodSchema,
  reviewAcknowledgeInputSchema,
  reviewCommentInputSchema,
  reviewDeleteCommentInputSchema,
  reviewListAcknowledgementsInputSchema,
  reviewVerdictInputSchema,
  searchQueryInputSchema,
  submitSectionSchema,
  trafficLightHistoryInputSchema,
  type UserSession,
} from "@customreport/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { Queue } from "bullmq";
import { z } from "zod";

import { isTelegramConfigured } from "../../lib/env.js";
import { groupScopeFilter } from "../../lib/group-scope.js";
import type { ActivityService } from "../../modules/activity/activity.service.js";
import { AdminService } from "../../modules/admin/admin.service.js";
import type { JobsService } from "../../modules/admin/jobs.service.js";
import type { SessionRevocationService } from "../../modules/admin/session-revocation.service.js";
import type { AnalyticsService } from "../../modules/analytics/analytics.service.js";
import type { ArchiveService } from "../../modules/archive/archive.service.js";
import { OrganizationService } from "../../modules/organization/organization.service.js";
import { PdfExportService } from "../../modules/pdf-export/pdf-export.service.js";
import type { PeriodService } from "../../modules/period/application/period.service.js";
import type { ProjectActivityService } from "../../modules/project-activity/project-activity.service.js";
import { PublicationService } from "../../modules/publication/application/publication.service.js";
import { RemindersService } from "../../modules/reminders/reminders.service.js";
import type { LeadFormService } from "../../modules/report-sections/application/lead-form.service.js";
import type { ReportSectionsService } from "../../modules/report-sections/application/report-sections.service.js";
import type { ReviewService } from "../../modules/review/application/review.service.js";
import type { ReviewActionsService } from "../../modules/review/application/review-actions.service.js";
import {
  SearchAuthorizationError,
  type SearchService,
} from "../../modules/search/search.service.js";
import { TELEGRAM_OUTBOUND_JOB_OPTS } from "../../modules/telegram/telegram.queue.js";
import type { TelemetryService } from "../../modules/telemetry/telemetry.service.js";
import type { WeeklyReportService } from "../../modules/weekly-report/weekly-report.service.js";
import { captureJobTraceContext } from "../bullmq/worker-observability.js";
import type { EnvConfig } from "../config/env.schema";
import { customreportReopenRequestsTotal } from "../metrics/metrics.registry.js";
import { clearOrgCache } from "./trpc.context.js";
import { mapDomainError } from "./trpc.error-mapper.js";
import {
  adminProcedure,
  anyRoleProcedure,
  headProcedure,
  leadershipProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./trpc.middleware.js";

// dev.wipeAndReseed: child-process timeout per seed tier — larger tiers write
// more rows and need more wall-clock room.
const MANUAL_UAT_RESEED_TIMEOUT_MINUTES = 1;
const HUGE_RESEED_TIMEOUT_MINUTES = 5;
const DEFAULT_RESEED_TIMEOUT_MINUTES = 2;
const MANUAL_UAT_RESEED_TIMEOUT_MS =
  MANUAL_UAT_RESEED_TIMEOUT_MINUTES * MS_PER_MINUTE;
const HUGE_RESEED_TIMEOUT_MS = HUGE_RESEED_TIMEOUT_MINUTES * MS_PER_MINUTE;
const DEFAULT_RESEED_TIMEOUT_MS =
  DEFAULT_RESEED_TIMEOUT_MINUTES * MS_PER_MINUTE;
const RESEED_OUTPUT_TAIL_LINES = 15;
const RESEED_STDERR_TAIL_LENGTH = 500;
const RESEED_VARIANT_MANUAL_UAT = "manual-uat";

const REMINDER_RULE_OUT_OF_SCOPE_MESSAGE = "reminder-rule-out-of-scope";

const WEEKLY_REPORT_LOAD_LOG_PHASE = "weekly-report.load";
const WEEKLY_REPORT_GET_PROCEDURE = "weeklyReport.get";

const MAX_PERIOD_LIST_LIMIT = 200;
const DEFAULT_ACTION_LOG_LIMIT = 20;
const MAX_FAILED_JOBS_LIMIT = 200;
const MAX_REOPEN_NOTE_LENGTH = 500;
const DEFAULT_EXECUTION_LIST_LIMIT = 20;
const MAX_REOPEN_REASON_LENGTH = 500;

interface RouterDeps {
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
  adminService: AdminService;
  /**
   * Organization identity surface.
   *  - `org.getPublic` (publicProcedure) reads shortName/fullName for the
   *    anonymous landing hero.
   *  - `admin.getOrganization` / `admin.updateOrganization` manage the
   *    singleton row from the Settings → Identity tab.
   * Optional so existing role-coverage test fixtures that build the
   * router with `{}` deps keep compiling — those tests stub the entire
   * `deps` argument and never exercise the org.* paths.
   */
  organizationService?: OrganizationService;
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
}

/**
 * review-acknowledgement: resolve the review-actions service or fail loudly.
 * Optional on `RouterDeps` only so role-coverage fixtures build with `{}` deps;
 * a real boot always wires it, so `undefined` here is a config bug, not a
 * user-reachable state.
 */
function requireReviewActions(deps: RouterDeps): ReviewActionsService {
  if (!deps.reviewActionsService) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Review actions service is not configured.",
    });
  }
  return deps.reviewActionsService;
}

/**
 * A reminder rule's only group link is `rule.report -> section.author group`.
 * Resolve the rule's report id, rejecting a missing rule or a rule with no
 * report — a non-admin caller cannot be scoped against it, so it is out of
 * reach (FORBIDDEN, fail-closed).
 */
async function resolveScopedReminderReportId(
  prisma: PrismaClient,
  ruleId: string,
): Promise<string> {
  const rule = await prisma.reminderRule.findUnique({
    where: { id: ruleId },
    select: { reportId: true },
  });
  if (!rule?.reportId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: REMINDER_RULE_OUT_OF_SCOPE_MESSAGE,
    });
  }
  return rule.reportId;
}

/**
 * The rule is in scope iff its report carries at least one section whose author
 * is in the caller's group. The scope fragment filters on `author`, so it is
 * applied via `AND` to avoid clobbering any sibling `author` predicate.
 */
async function assertReportHasInScopeSection(
  prisma: PrismaClient,
  session: UserSession,
  reportId: string,
): Promise<void> {
  const section = await prisma.reportSection.findFirst({
    where: { reportId, AND: [groupScopeFilter(session, "reportSection")] },
    select: { id: true },
  });
  if (!section) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: REMINDER_RULE_OUT_OF_SCOPE_MESSAGE,
    });
  }
}

/**
 * The recipient of a manual execution must be an in-scope draft-section author
 * on the rule's report — not an arbitrary address (closes the open-mailer hole).
 */
async function assertDraftRecipientInScope(
  prisma: PrismaClient,
  session: UserSession,
  reportId: string,
  recipientEmail: string,
): Promise<void> {
  const section = await prisma.reportSection.findFirst({
    where: {
      reportId,
      status: "draft",
      author: { email: recipientEmail },
      AND: [groupScopeFilter(session, "reportSection")],
    },
    select: { id: true },
  });
  if (!section) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "reminder-recipient-out-of-scope",
    });
  }
}

/**
 * The set of recipient emails a non-admin caller may see in a rule's execution
 * history: every in-scope section author on the rule's report, plus the
 * caller's own email (escalation digests are addressed to the head themself).
 * Rejects a rule whose report has no in-scope section (out of reach).
 */
async function resolveInScopeRecipientEmails(
  prisma: PrismaClient,
  session: UserSession,
  ruleId: string,
): Promise<ReadonlySet<string>> {
  const reportId = await resolveScopedReminderReportId(prisma, ruleId);
  const sections = await prisma.reportSection.findMany({
    where: { reportId, AND: [groupScopeFilter(session, "reportSection")] },
    select: { author: { select: { email: true } } },
  });
  if (sections.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: REMINDER_RULE_OUT_OF_SCOPE_MESSAGE,
    });
  }
  return new Set([...sections.map((s) => s.author.email), session.email]);
}

/**
 * A single-lead dispatch is authorized against the `User` row, not a section —
 * an in-scope lead may have no section yet, which a section check could not
 * distinguish from an out-of-scope lead. Admin's empty scope fragment matches
 * any user (god-mode).
 */
async function assertLeadInScope(
  prisma: PrismaClient,
  session: UserSession,
  leadId: string,
): Promise<void> {
  const lead = await prisma.user.findFirst({
    where: { id: leadId, ...groupScopeFilter(session, "user") },
    select: { id: true },
  });
  if (!lead) {
    throw new TRPCError({ code: "FORBIDDEN", message: "lead-out-of-scope" });
  }
}

export function createAppRouter(deps: RouterDeps) {
  return router({
    // === Auth namespace ===
    auth: router({
      me: publicProcedure.query(({ ctx }) => {
        // ctx.session is UserSession | null; null means unauthenticated.
        // Returning null lets the client distinguish "loaded, no session"
        // from "still loading" without throwing — preventing the 401
        // interceptor from triggering an immediate redirect on every load.
        //
        // `session.organization` is hydrated by the
        // context factory (mirrors viewerGroupAccess pattern) so the web
        // chrome can render the brand without a second round-trip.
        return ctx.session;
      }),
      // fix-report-surface-integrity: the `/print` web route
      // gate needs the one bit `me` cannot give it — whether the inbound
      // cookie verified as a PDF-export-scoped JWT (`ctx.isPdfExport`) and the
      // bound `reportId` (`ctx.pdfReportId`). For a `requestedBy` PDF token the
      // synthetic session IS the requester's real session, so the session
      // alone cannot tell the PDF worker apart from that human; only these two
      // context flags discriminate. `publicProcedure` (not pdfExport-guarded),
      // so the worker token reaches it; returns the session too so the gate
      // reads the cookie once and branches worker / human-redirect / login.
      printGate: publicProcedure.query(({ ctx }) => {
        return {
          session: ctx.session,
          isPdfExport: ctx.isPdfExport,
          pdfReportId: ctx.pdfReportId,
        };
      }),
    }),

    // === Organization namespace ===
    // Public read-only surface for the anonymous landing page. Returns
    // only the `{ shortName, fullName }` pair — no timestamps, no ids —
    // so future schema fields cannot leak unintentionally to the public.
    org: router({
      getPublic: publicProcedure.query(async () => {
        try {
          if (!deps.organizationService) {
            // Fallback for in-memory test fixtures. Generic
            // identity — the concrete tenant brand lives in the seed
            // file / admin-edited Organization row, never here.
            return DEFAULT_ORGANIZATION_IDENTITY;
          }
          return await deps.organizationService.getPublic();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    }),

    // === Dev namespace (only mounted when AUTH_DEV_MODE=true) ===
    // Surfaces wipe/reseed shortcuts for the in-page DevRoleSwitcher widget
    // so a presenter can reset demo state between recordings without
    // dropping into a terminal. Each mutation refuses to do anything when
    // AUTH_DEV_MODE is unset, so accidental deploys of this file to a
    // production runtime cannot wipe real data.
    dev: router({
      // Lists every seeded user so a dev-mode login picker can show all of
      // them (not just the 3 hardcoded role buckets). publicProcedure so
      // the picker works before any session exists.
      listUsers: publicProcedure.query(async () => {
        if (process.env.AUTH_DEV_MODE !== "true") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Dev mode is not enabled",
          });
        }
        const users = await deps.prisma.user.findMany({
          select: { id: true, email: true, name: true, role: true },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        });
        return users;
      }),

      // Any authenticated role may reset demo data — this is a dev-only test
      // affordance (double-gated: dev router mount + the AUTH_DEV_MODE check
      // below), not a production admin capability.
      wipeAndReseed: protectedProcedure
        .input(
          z.object({
            variant: z
              .enum(["small", "middle", "huge", RESEED_VARIANT_MANUAL_UAT])
              .default("small"),
          }),
        )
        .mutation(async ({ input }) => {
          if (process.env.AUTH_DEV_MODE !== "true") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Dev mode is not enabled",
            });
          }
          // Run Prisma reset as a child process so "wipe & reseed" is a
          // real clean-slate operation in Docker too. The Prisma config
          // applies migrations; then we run the requested seed explicitly.
          const { execSync } = await import("node:child_process");
          const reset = "pnpm exec prisma migrate reset --force";
          // Tiers mirror the package.json seed scripts: small/huge run the
          // tiered demo writer; middle delegates to the standalone seed-simple.
          const seedDemo = (tier: "small" | "huge") =>
            `pnpm --dir apps/api exec tsx ../../prisma/seed-demo.ts ${tier}`;
          const middleSeed =
            "pnpm --dir apps/api exec tsx ../../prisma/seed-simple.ts";
          const manualUatWipe =
            "pnpm --dir apps/api exec tsx ../../prisma/wipe-manual-uat.ts";
          const seedFor = (variant: "small" | "middle" | "huge") =>
            variant === "middle" ? middleSeed : seedDemo(variant);
          const script =
            input.variant === RESEED_VARIANT_MANUAL_UAT
              ? manualUatWipe
              : `${reset} && ${seedFor(input.variant)}`;
          // Resolve repo root in both dev TS execution and built dist images.
          // Built Docker paths include dist/apps/api/src/... so a fixed
          // relative hop from import.meta.url can land under /app/apps. Prefer
          // the real cwd/workspace candidates and verify by schema existence.
          const fs = await import("node:fs");
          const path = await import("node:path");
          const url = await import("node:url");
          const __filename = url.fileURLToPath(import.meta.url);
          const repoRootCandidates = [
            deps.env.CUSTOMREPORT_REPO_ROOT,
            process.cwd(),
            path.resolve(process.cwd(), "../.."),
            path.resolve(path.dirname(__filename), "../../../../.."),
          ].filter((candidate): candidate is string => Boolean(candidate));
          const repoRoot = repoRootCandidates.find((candidate) =>
            fs.existsSync(path.join(candidate, "prisma/schema.prisma")),
          );
          if (!repoRoot) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Reseed failed: repository root was not found",
            });
          }
          try {
            const stdout = execSync(script, {
              cwd: repoRoot,
              encoding: "utf8",
              env: {
                ...process.env,
                PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
              },
              timeout:
                input.variant === RESEED_VARIANT_MANUAL_UAT
                  ? MANUAL_UAT_RESEED_TIMEOUT_MS
                  : input.variant === "huge"
                    ? HUGE_RESEED_TIMEOUT_MS
                    : DEFAULT_RESEED_TIMEOUT_MS,
            });
            return {
              ok: true,
              variant: input.variant,
              output: stdout
                .split("\n")
                .slice(-RESEED_OUTPUT_TAIL_LINES)
                .join("\n"),
            };
          } catch (error) {
            const stderrRaw =
              error instanceof Error && "stderr" in error
                ? (error as { stderr?: unknown }).stderr
                : undefined;
            const stderr =
              typeof stderrRaw === "string"
                ? stderrRaw
                : Buffer.isBuffer(stderrRaw)
                  ? stderrRaw.toString("utf8")
                  : "";
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Reseed failed: ${error instanceof Error ? error.message : String(error)}\n${stderr.slice(-RESEED_STDERR_TAIL_LENGTH)}`,
              cause: error instanceof Error ? error : undefined,
            });
          }
        }),
    }),

    // === Reports namespace ===
    reports: router({
      getActive: protectedProcedure.query(async ({ ctx }) => {
        try {
          if (!ctx.session.activeReportSectionId) {
            return null;
          }

          return await deps.reportSectionsService.getActiveSection(
            ctx.session.activeReportSectionId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      myHistory: protectedProcedure.query(async ({ ctx }) => {
        const sections = await deps.prisma.reportSection.findMany({
          where: { authorId: ctx.session.userId },
          // Order by reporting-period chronology (newest period first), NOT by
          // the section row's insertion time — `createdAt` is unrelated to the
          // period a report covers (seeds insert in one run). This matches the
          // `compiledHistory` ordering so both reads of the history surface
          // agree, and keeps the summary-rail streak (which assumes
          // newest-period-first) honest. `createdAt` is the stable tiebreak.
          orderBy: [{ report: { periodStart: "desc" } }, { createdAt: "desc" }],
          include: {
            report: {
              select: {
                id: true,
                periodStart: true,
                periodEnd: true,
                status: true,
                archived: true,
                publishedAt: true,
              },
            },
            items: {
              select: { projectId: true, updatedAt: true, priorityRank: true },
            },
            risks: {
              select: { projectId: true, updatedAt: true },
            },
            decisions: {
              select: { productId: true, updatedAt: true },
            },
            projectStatuses: {
              select: { projectId: true, status: true, updatedAt: true },
            },
            stageStatuses: {
              select: { projectId: true, updatedAt: true },
            },
          },
        });

        return myHistoryEntrySchema.array().parse(
          sections.map((s) => {
            const trafficLights = { green: 0, yellow: 0, red: 0 };
            for (const row of s.projectStatuses) {
              if (row.status === "green") trafficLights.green += 1;
              if (row.status === "yellow") trafficLights.yellow += 1;
              if (row.status === "red") trafficLights.red += 1;
            }

            const productIds = new Set<string>();
            for (const row of s.projectStatuses) productIds.add(row.projectId);
            for (const row of s.stageStatuses) productIds.add(row.projectId);
            // activity-first-class: activity-parented rows carry a null product
            // FK and contribute no product id to the distinct-product count.
            for (const row of s.items)
              if (row.projectId) productIds.add(row.projectId);
            for (const row of s.risks)
              if (row.projectId) productIds.add(row.projectId);
            for (const row of s.decisions)
              if (row.productId) productIds.add(row.productId);

            const editDates = [
              s.updatedAt,
              ...s.items.map((row) => row.updatedAt),
              ...s.risks.map((row) => row.updatedAt),
              ...s.decisions.map((row) => row.updatedAt),
              ...s.projectStatuses.map((row) => row.updatedAt),
              ...s.stageStatuses.map((row) => row.updatedAt),
            ];
            const lastEditAt = editDates.reduce(
              (latest, date) => (date > latest ? date : latest),
              editDates[0],
            );

            return {
              sectionId: s.id,
              reportId: s.report.id,
              periodStart: s.report.periodStart,
              periodEnd: s.report.periodEnd,
              reportStatus: s.report.status,
              sectionStatus: s.status,
              archived: s.report.archived,
              submittedAt: s.submittedAt,
              publishedAt: s.report.publishedAt,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              lastEditAt,
              itemCount: s.items.length,
              riskCount: s.risks.length,
              decisionCount: s.decisions.length,
              priorityCount: s.items.filter((i) => i.priorityRank != null)
                .length,
              productCount: productIds.size,
              trafficLights,
            };
          }),
        );
      }),

      compiledHistory: anyRoleProcedure
        .input(compiledHistoryInputSchema.optional())
        .query(async ({ input, ctx }) => {
          try {
            const includeArchive = input?.includeArchive ?? false;
            const sectionScope: Prisma.ReportSectionWhereInput =
              ctx.session.role === "lead"
                ? { authorId: ctx.session.userId }
                : groupScopeFilter(ctx.session, "reportSection");
            const visibleSectionWhere: Prisma.ReportWhereInput = {
              sections: { some: sectionScope },
            };
            // viewer-live-status (task 3.1 / Decision 5): the viewer read gate is
            // published-or-current, so a reopened period (legacy
            // `status="published"`, `periodStatus="reopened"`) would otherwise be
            // listed in the viewer's History as a gate-rejected broken link.
            // Narrow the VIEWER History to `periodStatus="published"` only. This
            // MUST be viewer-only — `compiledHistory` is a shared
            // `anyRoleProcedure`, and an unconditional filter would silently drop
            // reopened periods from head/lead History (a non-goal). Applied to
            // BOTH `listWhere` and `archiveCountWhere` so the list and the
            // archive count agree for the viewer.
            const viewerPeriodFilter: Prisma.ReportWhereInput =
              ctx.session.role === "viewer"
                ? { periodStatus: "published" as const }
                : {};
            const listWhere: Prisma.ReportWhereInput = {
              status: "published" as const,
              ...(includeArchive ? {} : { archived: false }),
              ...viewerPeriodFilter,
              ...visibleSectionWhere,
            };
            const archiveCountWhere: Prisma.ReportWhereInput = {
              status: "published" as const,
              archived: true,
              ...viewerPeriodFilter,
              ...visibleSectionWhere,
            };

            const [reports, archiveCount] = await Promise.all([
              deps.prisma.report.findMany({
                where: listWhere,
                orderBy: { periodStart: "desc" },
                take: 100,
                include: {
                  publishedBy: { select: { name: true } },
                  sections: {
                    where: sectionScope,
                    select: {
                      items: {
                        select: { projectId: true, priorityRank: true },
                      },
                      risks: { select: { projectId: true } },
                      decisions: { select: { productId: true } },
                      projectStatuses: {
                        select: { projectId: true, status: true },
                      },
                      stageStatuses: { select: { projectId: true } },
                    },
                  },
                },
              }),
              deps.prisma.report.count({ where: archiveCountWhere }),
            ]);

            const entries = reports
              .filter((report) => report.sections.length > 0)
              .map((report) => {
                const trafficLights = { green: 0, yellow: 0, red: 0 };
                const productIds = new Set<string>();
                // eslint-disable-next-line no-restricted-syntax -- Compiled-history folds counters and product ids in one scoped pass; split reductions would rescan nested rows and obscure the shared filter.
                let itemCount = 0;
                // eslint-disable-next-line no-restricted-syntax -- Compiled-history folds counters and product ids in one scoped pass; split reductions would rescan nested rows and obscure the shared filter.
                let riskCount = 0;
                // eslint-disable-next-line no-restricted-syntax -- Compiled-history folds counters and product ids in one scoped pass; split reductions would rescan nested rows and obscure the shared filter.
                let decisionCount = 0;
                // eslint-disable-next-line no-restricted-syntax -- Compiled-history folds counters and product ids in one scoped pass; split reductions would rescan nested rows and obscure the shared filter.
                let priorityCount = 0;

                for (const section of report.sections) {
                  itemCount += section.items.length;
                  riskCount += section.risks.length;
                  decisionCount += section.decisions.length;
                  priorityCount += section.items.filter(
                    (i) => i.priorityRank != null,
                  ).length;

                  for (const row of section.projectStatuses) {
                    productIds.add(row.projectId);
                    if (row.status === "green") trafficLights.green += 1;
                    if (row.status === "yellow") trafficLights.yellow += 1;
                    if (row.status === "red") trafficLights.red += 1;
                  }
                  for (const row of section.stageStatuses) {
                    productIds.add(row.projectId);
                  }
                  // activity-first-class: activity-parented rows carry a null
                  // product FK and contribute no product id here.
                  for (const row of section.items) {
                    if (row.projectId) productIds.add(row.projectId);
                  }
                  for (const row of section.risks) {
                    if (row.projectId) productIds.add(row.projectId);
                  }
                  for (const row of section.decisions) {
                    if (row.productId) productIds.add(row.productId);
                  }
                }

                return {
                  reportId: report.id,
                  periodStart: report.periodStart,
                  periodEnd: report.periodEnd,
                  publishedAt: report.publishedAt,
                  archived: report.archived,
                  publishedByName: report.publishedBy?.name ?? "Unknown",
                  trafficLights,
                  itemCount,
                  riskCount,
                  decisionCount,
                  priorityCount,
                  sectionCount: report.sections.length,
                  productCount: productIds.size,
                };
              });

            return compiledHistoryResultSchema.parse({
              entries,
              archiveCount,
            });
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // viewer-live-status (task 1.1): resolve the **Status target** for the
      // `/reports/latest` redirect. The target is the current editable period
      // (Decision 0 — the exact id the read gate authorizes) when that period
      // has a viewer-visible section, else the newest viewer-visible published
      // report, else `null` (empty state). It must NOT search older editable
      // periods: the gate authorizes only the current editable id, so routing to
      // an older editable report would land on a target the gate rejects.
      // `sections.some(sectionScope)` reuses the same group filter as
      // `compiledHistory`; a lead resolves their own authored sections.
      latestForViewer: anyRoleProcedure.query(async ({ ctx }) => {
        try {
          const sectionScope: Prisma.ReportSectionWhereInput =
            ctx.session.role === "lead"
              ? { authorId: ctx.session.userId }
              : groupScopeFilter(ctx.session, "reportSection");

          // Decision 0: one source of truth, through the service (the router
          // has no repository handle).
          const currentEditableId =
            await deps.weeklyReportService.getCurrentEditableId();

          if (currentEditableId) {
            const currentVisible = await deps.prisma.report.findFirst({
              where: {
                id: currentEditableId,
                sections: { some: sectionScope },
              },
              select: { id: true },
            });
            if (currentVisible) {
              return latestForViewerReportSchema.parse({
                reportId: currentVisible.id,
              });
            }
          }

          // Fallback: newest viewer-visible published report (group-scoped).
          // `id desc` is a deterministic tiebreak so two published reports
          // sharing a `periodStart` resolve to a stable id (same rationale as
          // getCurrentEditableId — Decision 3).
          const published = await deps.prisma.report.findFirst({
            where: {
              periodStatus: "published" as const,
              sections: { some: sectionScope },
            },
            orderBy: [{ periodStart: "desc" }, { id: "desc" }],
            select: { id: true },
          });

          return latestForViewerReportSchema.parse({
            reportId: published?.id ?? null,
          });
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      saveDraft: protectedProcedure
        .input(draftSaveSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.reportSectionsService.saveDraft(
              input,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      submit: protectedProcedure
        .input(submitSectionSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.reportSectionsService.submitSection(
              input,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Review namespace ===
    review: router({
      // review.dashboard is headProcedure — defense-in-depth: only heads (and
      // admins, aliased) see the submission dashboard.
      dashboard: headProcedure.query(async ({ ctx }) => {
        try {
          // Resolve the current editable period from the DB through the shared
          // current-editable resolver (newest non-archived open/reopened period,
          // periodStart <= now, ordered periodStart desc then id desc) instead
          // of ctx.session.activeReportId (baked into the JWT at login, can be
          // stale). assembledReport and publish resolve through the same method,
          // so all three agree on the target period; the archived:false filter
          // and id-desc tiebreak keep the pick non-arbitrary.
          const reportId =
            await deps.weeklyReportService.getCurrentEditableId();

          if (!reportId) {
            return [];
          }

          return await deps.reviewService.getSubmissionDashboard(
            reportId,
            ctx.session,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      assembledReport: headProcedure.query(async () => {
        try {
          const reportId =
            await deps.weeklyReportService.getCurrentEditableId();

          if (!reportId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "No active period.",
            });
          }

          return await deps.publicationService.getAssembledReport(reportId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      publish: headProcedure.mutation(async ({ ctx }) => {
        try {
          const reportId =
            await deps.weeklyReportService.getCurrentEditableId();

          if (!reportId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "No active period to publish.",
            });
          }

          return await deps.publicationService.publishReport(
            reportId,
            ctx.session,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      // review-acknowledgement: all on `leadershipProcedure` (head + admin +
      // viewer; lead excluded) so `role-coverage-gate` stays green; the
      // per-group scope + reviewer designation are enforced in the service.

      // Group-level "seen" receipt — any access-holder (scope check only).
      acknowledge: leadershipProcedure
        .input(reviewAcknowledgeInputSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            return await requireReviewActions(deps).acknowledge(
              ctx.session,
              input,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // Who has acknowledged the group's report this period (head surface).
      acknowledgements: leadershipProcedure
        .input(reviewListAcknowledgementsInputSchema)
        .query(async ({ input, ctx }) => {
          try {
            return await requireReviewActions(deps).listAcknowledgements(
              ctx.session,
              input,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // Per-record comment — designated reviewer for the record's group.
      comment: leadershipProcedure
        .input(reviewCommentInputSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            return await requireReviewActions(deps).comment(ctx.session, input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteComment: leadershipProcedure
        .input(reviewDeleteCommentInputSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            return await requireReviewActions(deps).deleteComment(
              ctx.session,
              input,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // Per-section verdict; `changes_requested` auto-un-submits, race-safe.
      verdict: leadershipProcedure
        .input(reviewVerdictInputSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            return await requireReviewActions(deps).verdict(ctx.session, input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === PDF Export namespace ===
    pdfExport: router({
      // fix-report-surface-integrity: Export-PDF is gated by
      // `leadershipProcedure` (head + admin + viewer). Lead is EXCLUDED and
      // gets FORBIDDEN — a lead is the data subject of the report, not an
      // exporter; the lead UI surfaces a ComingSoon control instead of firing
      // the export. request + status share the same gate so a permitted caller
      // can both fire the job and poll its status. The PDF render is
      // REQUESTER-SCOPED: the worker token carries the requester's userId and
      // the print page renders under their rebuilt session, so each role's PDF
      // matches their in-app view (head/admin → full report, viewer → their
      // slice). Viewer export is safe because the empty-PDF fix gives the viewer
      // a non-empty, scoped render.
      request: leadershipProcedure
        .input(z.object({ reportId: z.uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            // Thread session userId so the pdf_export_jobs row
            // attributes the request to the requester, not 'system'.
            return await deps.pdfExportService.requestPdfExport(
              input.reportId,
              ctx.session.userId,
              undefined,
              // Role label for
              // customreport_pdf_export_requests_total{role}.
              ctx.session.role,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      status: leadershipProcedure
        .input(z.object({ jobId: z.uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await deps.pdfExportService.getPdfExportStatus(
              input.jobId,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Admin namespace ===
    admin: router({
      snapshot: adminProcedure.query(async () => {
        try {
          return await deps.adminService.getSnapshot();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      getSettings: adminProcedure.query(async () => {
        try {
          return await deps.adminService.getSettings();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      updateSettings: adminProcedure
        .input(appSettingsUpdateSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.updateSettings(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Read the external-integrations status bundle
       * for the Settings → Integrations sub-tab. v1 carries Telegram only.
       * Telegram is considered «active» only when both the API has
       * `TG_BOT_TOKEN` set AND at least one TelegramBinding row has
       * `active=true`. Either gate failing keeps the badge muted.
       *
       * adminProcedure-gated (head/admin) so a regular lead can't poll the
       * binding count.
       */
      integrationsStatus: adminProcedure.query(async () => {
        try {
          const configured = isTelegramConfigured(deps.env);
          const bindings = await deps.prisma.telegramBinding.count({
            where: { active: true },
          });
          return {
            telegram: {
              configured,
              bindings,
            },
          };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      /**
       * Admin smoke-test for the telegram-outbound
       * queue. Enqueues a single job that the in-process TelegramProcessor
       * picks up and forwards to the MockTelegramAdapter (or the real bot
       * once activated). Returns `{ jobId }` so the admin UI can confirm
       * the job was queued without subscribing to BullMQ events.
       *
       * Retry policy lives on the job options (3 attempts, exponential
       * backoff) so this surface stays generic; producers don't need to
       * know about queue semantics.
       */
      testTelegramSend: adminProcedure
        .input(adminTestTelegramSendSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            if (!deps.telegramOutboundQueue) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message:
                  "Telegram outbound queue is not wired into the tRPC router.",
              });
            }
            const job = await deps.telegramOutboundQueue.add(
              "telegram-test",
              {
                chatId: input.chatId,
                text: input.text,
                ...captureJobTraceContext(ctx.correlationId),
              },
              { ...TELEGRAM_OUTBOUND_JOB_OPTS },
            );
            return { jobId: job.id ?? null };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Read the singleton `Organization` row for
       * the Settings → Identity tab. The full row (including timestamps)
       * is returned so the admin form can show a "last updated" hint;
       * the public landing page uses `org.getPublic` instead.
       */
      getOrganization: adminProcedure.query(async () => {
        try {
          if (!deps.organizationService) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "OrganizationService is not wired into the tRPC router.",
            });
          }
          return await deps.organizationService.getOrganization();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      /**
       * Update the singleton `Organization` row.
       * Emits the dedicated `admin.organization.update` audit event in
       * addition to the generic `mutation` envelope so SIEM rules and
       * brand-tampering dashboards can filter on `event` without parsing
       * the procedure string. The before-state is read inside the same
       * call (small extra query) so the audit line carries both the
       * previous and the new identity.
       */
      updateOrganization: adminProcedure
        .input(organizationUpdateSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            if (!deps.organizationService) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message:
                  "OrganizationService is not wired into the tRPC router.",
              });
            }
            const previous = await deps.organizationService.getOrganization();
            const next =
              await deps.organizationService.updateOrganization(input);
            clearOrgCache();
            ctx.auditLogger.organizationUpdate({
              userId: ctx.session.userId,
              role: ctx.session.role,
              ip: ctx.ip,
              previousShortName: previous.shortName,
              previousFullName: previous.fullName,
              nextShortName: next.shortName,
              nextFullName: next.fullName,
            });
            return next;
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      saveUser: adminProcedure
        .input(adminUserSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.upsertUser(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      saveReportingGroup: adminProcedure
        .input(reportingGroupSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.upsertReportingGroup(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      archiveReportingGroup: adminProcedure
        .input(z.object({ groupId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.archiveReportingGroup(input.groupId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      saveProject: adminProcedure
        .input(adminProjectSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.upsertProject(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      savePeriod: adminProcedure
        .input(reportPeriodSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.upsertPeriod(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Per-period reminder rules are no longer
       * written through the admin tab. Rules are derived from
       * `ReminderPolicy` rows by the period scheduler in 44-03+. The
       * read path (admin.getSnapshot.reminderRules) stays as-is so the
       * 44-04 admin UI can still visualize derived rows inline.
       */
      saveReminderRule: adminProcedure
        .input(adminReminderRuleSchema)
        .mutation(() => {
          throw new TRPCError({
            code: "METHOD_NOT_SUPPORTED",
            message:
              "Per-period reminder rules are read-only as of Phase 44 (UFB-036). Use admin.savePolicy instead.",
          });
        }),

      /**
       * List all reminder policies (active +
       * archived). Used by the admin tab to render the policy editor
       * grid.
       */
      listPolicies: adminProcedure.query(async () => {
        try {
          return await deps.adminService.listPolicies();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      /**
       * Upsert a reminder policy
       * by id. The dedicated `admin.policy.save` audit event is emitted
       * in addition to the generic `mutation` envelope so SIEM rules
       * filtering on `event` (and dashboards splitting create vs update)
       * don't have to parse the procedure name. Existence check runs
       * BEFORE the upsert so the audit `action` reflects the pre-state.
       */
      savePolicy: adminProcedure
        .input(reminderPolicySchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const existed = await deps.adminService.policyExists(input.id);
            const saved = await deps.adminService.savePolicy(input);
            ctx.auditLogger.policySave({
              userId: ctx.session.userId,
              role: ctx.session.role,
              ip: ctx.ip,
              policyId: saved.id,
              kind: saved.kind,
              action: existed ? "update" : "create",
            });
            return saved;
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Archive a reminder policy.
       * Repository hard-deletes when no derived rules exist; otherwise
       * flips the `active` flag. The dedicated `admin.policy.remove`
       * audit event is emitted on the success path only — failed
       * removals already surface through the generic `mutation` audit
       * envelope.
       */
      removePolicy: adminProcedure
        .input(z.object({ id: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
          try {
            const result = await deps.adminService.removePolicy(input.id);
            ctx.auditLogger.policyRemove({
              userId: ctx.session.userId,
              role: ctx.session.role,
              ip: ctx.ip,
              policyId: input.id,
            });
            return result;
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Paginated period list for the redesigned
       * Admin → Periods tab. Filters by lifecycle bucket
       * (`active | archive | <PeriodState>`) using the
       * `(periodState, periodStart desc)` index. Returns
       * rich rows with server-precomputed `canReopen` / `canArchive`
       * so the UI does not need to know the reopen-policy rules.
       */
      listPeriodsByState: adminProcedure
        .input(
          z.object({
            bucket: periodListBucketSchema,
            limit: z
              .number()
              .int()
              .min(1)
              .max(MAX_PERIOD_LIST_LIMIT)
              .optional(),
          }),
        )
        .query(async ({ input }) => {
          try {
            return await deps.adminService.listPeriodsByState(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Admin escape hatch that mints a Period without waiting
       * for the daily `PeriodCreatorScheduler` (00:05 UTC cron). Fresh
       * dev/staging DBs were blocked on the cron tick before this
       * procedure landed; admins can now seed a period from the
       * Periods-tab «New period» dialog.
       *
       * Audit envelope (`period.manual-create`) is emitted from the
       * router — same pattern as `savePolicy` / `removePolicy` — so
       * audit IO stays out of the service layer and the SIEM stream
       * gets a real-user attribution (vs the system+cron `auto-create`
       * event).
       */
      createPeriodManual: adminProcedure
        .input(adminCreatePeriodManualSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const result = await deps.adminService.createPeriodManual(input);
            ctx.auditLogger.periodManualCreate({
              userId: ctx.session.userId,
              role: ctx.session.role,
              ip: ctx.ip,
              periodId: result.periodId,
              periodStart: result.periodStart.toISOString(),
              periodEnd: result.periodEnd.toISOString(),
              deadline: result.deadline.toISOString(),
              from: null,
              to: result.periodState,
            });
            // Only an open-born period carries now; a future-dated one is
            // minted `scheduled` and the scheduler carries it at flip time.
            if (result.periodState === "open") {
              await deps.autoCarryOver?.(result.periodId);
            }
            return result;
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Admin in-place edit for an existing Period's date
       * envelope + weekLabel. Symmetric counterpart to
       * `createPeriodManual` so the row-level Edit icon in the Periods
       * tab can reuse the same `<CreatePeriodDialog>` UI in "edit" mode.
       *
       * Audit envelope (`period.manual-edit`) emitted only when the diff
       * is non-empty — service short-circuits no-op edits, returning an
       * empty diff which the router treats as "nothing to audit". This
       * keeps SIEM rules that key on `changes.<field>` presence free of
       * empty-payload noise from PATCH calls that didn't actually change
       * the row.
       */
      updatePeriodManual: adminProcedure
        .input(adminUpdatePeriodManualSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const { result, diff } =
              await deps.adminService.updatePeriodManual(input);
            if (Object.keys(diff).length > 0) {
              // Convert Date instances to ISO strings for the audit
              // payload (the envelope is shipped to log aggregators that
              // serialize timestamps to JSON; ISO is the canonical form).
              const changes: {
                periodStart?: { from: string; to: string };
                periodEnd?: { from: string; to: string };
                deadline?: { from: string; to: string };
                weekLabel?: { from: string | null; to: string | null };
              } = {};
              if (diff.periodStart) {
                changes.periodStart = {
                  from: diff.periodStart.from.toISOString(),
                  to: diff.periodStart.to.toISOString(),
                };
              }
              if (diff.periodEnd) {
                changes.periodEnd = {
                  from: diff.periodEnd.from.toISOString(),
                  to: diff.periodEnd.to.toISOString(),
                };
              }
              if (diff.deadline) {
                changes.deadline = {
                  from: diff.deadline.from.toISOString(),
                  to: diff.deadline.to.toISOString(),
                };
              }
              if (diff.weekLabel) {
                changes.weekLabel = diff.weekLabel;
              }
              ctx.auditLogger.periodManualEdit({
                userId: ctx.session.userId,
                role: ctx.session.role,
                ip: ctx.ip,
                periodId: result.periodId,
                changes,
              });
            }
            return result;
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Manual archive. Sets both `archived=true`
       * and `periodState='archived'` atomically so the two-state-machine
       * invariant is preserved.
       */
      archivePeriod: adminProcedure
        .input(z.object({ periodId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.archivePeriod(input.periodId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Manual un-archive — flips `archived=false`
       * and derives the next `periodState` from the legacy
       * `(status, periodStatus)` tuple at write time (the new state
       * column lost the pre-archive distinction when it was overwritten
       * with 'archived').
       */
      unarchivePeriod: adminProcedure
        .input(z.object({ periodId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.unarchivePeriod(input.periodId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Delete a period (Report) and cascade-delete all child rows.
       * Guard: cannot delete published periods.
       */
      deleteReport: adminProcedure
        .input(z.object({ reportId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.deleteReport(input.reportId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteUser: adminProcedure
        .input(z.object({ userId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.removeUser(input.userId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Deactivate a user — sets isActive=false in
       * Prisma and adds the userId to the Redis revoked set so any in-flight
       * JWT session is rejected immediately by the context factory.
       */
      deactivateUser: adminProcedure
        .input(z.object({ userId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            await deps.prisma.user.update({
              where: { id: input.userId },
              data: { isActive: false },
            });
            await deps.sessionRevocationService?.revokeSession(input.userId);
            return { success: true as const };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Re-activate a user — sets isActive=true in
       * Prisma and removes the userId from the Redis revoked set so new logins
       * can proceed normally.
       */
      activateUser: adminProcedure
        .input(z.object({ userId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            await deps.prisma.user.update({
              where: { id: input.userId },
              data: { isActive: true },
            });
            await deps.sessionRevocationService?.restoreSession(input.userId);
            return { success: true as const };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteProject: adminProcedure
        .input(z.object({ projectId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.removeProject(input.projectId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteReminderRule: adminProcedure
        .input(z.object({ ruleId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.removeReminderRule(input.ruleId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      saveStageAssignment: adminProcedure
        .input(
          z.object({
            userId: z.uuid(),
            stageId: z.uuid(),
            projectId: z.uuid(),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.saveStageAssignment(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteStageAssignment: adminProcedure
        .input(z.object({ id: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.deleteStageAssignment(input.id);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      listStageAssignments: adminProcedure
        .input(z.object({ projectId: z.uuid() }))
        .query(async ({ input }) => {
          try {
            return await deps.adminService.listStageAssignments(
              input.projectId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // Full SDLC stage catalogue. Used by the Stage Assignment editor so it
      // can render *every* stage (including unassigned ones), not just the
      // stages that already have an assignment row for the project.
      listStages: adminProcedure.query(async () => {
        try {
          const rows = await deps.prisma.stage.findMany({
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, sortOrder: true },
          });
          return rows;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      // Per-project assignment count for the products-tab "X/7 stages"
      // header. Light query (single GROUP BY) so we can render the count
      // without loading every assignment row.
      listStageAssignmentCounts: adminProcedure.query(async () => {
        try {
          const rows = await deps.prisma.stageAssignment.groupBy({
            by: ["projectId"],
            _count: { _all: true },
          });
          return rows.map((r) => ({
            projectId: r.projectId,
            count: r._count._all,
          }));
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      // -----------------------------------------------------------------
      // Explicit Group ↔ Product M:M surface.
      //
      // Mutations are idempotent (attach upserts on the unique tuple;
      // detach uses deleteMany so a double-click is harmless). Reads are
      // straight findMany joins ordered by name. All four procedures are
      // gated by adminProcedure — head/admin only, like saveProject and
      // saveReportingGroup. The generic mutationAuditMiddleware captures
      // the {procedure, targetId} envelope; no dedicated audit event is
      // emitted yet (consistent with saveProject — added later only if
      // SIEM needs the split).
      // -----------------------------------------------------------------

      attachProductToGroup: adminProcedure
        .input(groupProductEdgeInputSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.attachProductToGroup(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      detachProductFromGroup: adminProcedure
        .input(groupProductEdgeInputSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.detachProductFromGroup(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      listGroupProducts: adminProcedure
        .input(z.object({ groupId: z.uuid() }))
        .query(async ({ input }) => {
          try {
            return await deps.adminService.listGroupProducts(input.groupId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      listProductGroups: adminProcedure
        .input(z.object({ productId: z.uuid() }))
        .query(async ({ input }) => {
          try {
            return await deps.adminService.listProductGroups(input.productId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // Batched owning-group lookup: one query resolves the owning group for
      // every requested product, so the "products attached" editor no longer
      // fans out one listProductGroups call per active product.
      listProductGroupOwnership: adminProcedure
        .input(z.object({ productId: z.array(z.uuid()) }))
        .query(async ({ input }) => {
          try {
            return await deps.adminService.listProductGroupOwnership(
              input.productId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // BullMQ DLQ count — failed-jobs set of the
      // email-reminder queue. adminProcedure (admin/head only).
      // Returns { count: 0 } when the Queue handle is absent (e.g. unit test
      // wiring) so the procedure is always callable.
      dlqCount: adminProcedure.query(async () => {
        try {
          if (!deps.emailReminderQueue) {
            return { count: 0 };
          }
          const count = await deps.emailReminderQueue.getFailedCount();
          return { count };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      // Queryable in-app mutation audit history. The log rows are
      // written by mutationAuditMiddleware and keyed by the same correlation id
      // as the structured app.log line for support/debug lookups.
      actionLog: router({
        list: adminProcedure
          .input(paginationInputSchema.optional())
          .query(async ({ input }) => {
            try {
              const limit = input?.limit ?? DEFAULT_ACTION_LOG_LIMIT;
              const cursor = input?.cursor;
              const rows = await deps.prisma.userActionLog.findMany({
                take: limit + 1,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: { createdAt: "desc" },
              });
              const hasMore = rows.length > limit;
              const items = rows.slice(0, limit);
              const nextCursor = hasMore
                ? (items[items.length - 1]?.id ?? null)
                : null;
              return {
                items: items.map((row) => ({
                  id: row.id,
                  userId: row.userId,
                  role: row.role,
                  procedure: row.procedure,
                  targetId: row.targetId,
                  status: row.status,
                  reason: row.reason,
                  ip: row.ip,
                  correlationId: row.correlationId,
                  durationMs: row.durationMs,
                  createdAt: row.createdAt.toISOString(),
                })),
                nextCursor,
              };
            } catch (error) {
              throw mapDomainError(error);
            }
          }),
      }),

      // BullMQ DLQ admin surface. Lifts the Bull Board view
      // (/admin/queues) into the in-app /admin?tab=jobs page so the head can
      // triage failed jobs without leaving the SPA. adminProcedure (admin/head
      // only). Mutation audit (procedure='admin.jobs.retryFailed', target=jobId)
      // is captured by mutationAuditMiddleware automatically.
      jobs: router({
        listFailed: adminProcedure
          .input(
            z.object({
              queue: queueNameSchema,
              cursor: z.number().int().min(0).optional(),
              limit: z
                .number()
                .int()
                .min(1)
                .max(MAX_FAILED_JOBS_LIMIT)
                .optional(),
            }),
          )
          .query(async ({ input }) => {
            try {
              const service = deps.jobsService;
              if (!service) {
                return { jobs: [], nextCursor: null };
              }
              return await service.listFailed(input);
            } catch (error) {
              throw mapDomainError(error);
            }
          }),

        retryFailed: adminProcedure
          .input(
            z.object({
              queue: queueNameSchema,
              jobId: z.string().min(1),
            }),
          )
          .mutation(async ({ input }) => {
            try {
              const service = deps.jobsService;
              if (!service) {
                return { retried: false, jobId: input.jobId };
              }
              return await service.retryFailed(input);
            } catch (error) {
              throw mapDomainError(error);
            }
          }),
      }),

      // Reopen requests — Lead-initiated, Head-decided. The Lead's
      // `leadForm.requestReopen` mutation persists a row with status=pending;
      // the head dashboard card and the Admin Panel "Reopen Requests" tab
      // consume these procedures. reopen-request-lifecycle (ADR 0008): the gate
      // is `headProcedure` (head + admin), not `adminProcedure` — in the real
      // deployment head ≠ admin, and reopen-decisioning is a head capability.
      listReopenRequests: headProcedure
        .input(
          z
            .object({
              status: z
                .enum(["pending", "approved", "rejected", "all"])
                .default("pending"),
            })
            .optional(),
        )
        .query(async ({ input, ctx }) => {
          try {
            const status = input?.status ?? "pending";
            const statusFilter = status === "all" ? {} : { status };
            // reopen-request-lifecycle: a head sees only its own group's
            // requests; admin is global ({}). The scope fragment is a
            // ReportSectionWhereInput, so it nests UNDER reportSection — these
            // are ReopenRequest queries, not ReportSection queries.
            const scope = groupScopeFilter(ctx.session, "reportSection");
            const rows = await deps.prisma.reopenRequest.findMany({
              where: { ...statusFilter, reportSection: scope },
              orderBy: { createdAt: "desc" },
              take: 100,
              include: {
                requestedBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
                reportSection: {
                  include: {
                    report: {
                      select: {
                        id: true,
                        weekLabel: true,
                        periodStart: true,
                        periodEnd: true,
                      },
                    },
                  },
                },
              },
            });
            return rows.map((r) => ({
              id: r.id,
              reportSectionId: r.reportSectionId,
              reason: r.reason,
              status: r.status,
              reviewNote: r.reviewNote,
              reviewedAt: r.reviewedAt?.toISOString() ?? null,
              createdAt: r.createdAt.toISOString(),
              requestedBy: r.requestedBy,
              reviewedBy: r.reviewedBy,
              sectionStatus: r.reportSection.status,
              report: {
                id: r.reportSection.report.id,
                weekLabel: r.reportSection.report.weekLabel,
                periodStart: r.reportSection.report.periodStart.toISOString(),
                periodEnd: r.reportSection.report.periodEnd.toISOString(),
              },
            }));
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      respondReopenRequest: headProcedure
        .input(
          z.object({
            id: z.uuid(),
            decision: z.enum(["approved", "rejected"]),
            note: z.string().max(MAX_REOPEN_NOTE_LENGTH).optional(),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            // reopen-request-lifecycle: scoped re-load — a head cannot
            // decide an out-of-group request by passing its id (the scoped
            // findFirst finds nothing → reject). Admin scope is {} (global).
            const scope = groupScopeFilter(ctx.session, "reportSection");
            const req = await deps.prisma.reopenRequest.findFirst({
              where: { id: input.id, reportSection: scope },
              select: { id: true, reportSectionId: true },
            });
            if (!req) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Reopen request not found.",
              });
            }

            const reviewNote = input.note?.trim() ? input.note.trim() : null;
            const decidedBy = ctx.session.userId;

            // reopen-request-lifecycle: the decision is race-safe against a
            // second decider (head + admin can both act). The status re-check
            // and the section flip happen inside ONE transaction via conditional
            // updateMany; only the row-count-1 winner takes effect.
            const outcome = await deps.prisma.$transaction(async (tx) => {
              const decided = await tx.reopenRequest.updateMany({
                where: { id: req.id, status: "pending" },
                data: {
                  status: input.decision,
                  reviewedById: decidedBy,
                  reviewedAt: new Date(),
                  reviewNote,
                },
              });
              // Loser of a concurrent decision: nothing changed.
              if (decided.count === 0) {
                return { kind: "already-processed" as const };
              }

              if (input.decision === "rejected") {
                return {
                  kind: "decided" as const,
                  decision: "rejected" as const,
                };
              }

              // Approve = flip the section back to draft so the lead can edit
              // again, but ONLY if it is still submitted. A separate revoke can
              // have flipped it to draft while the request stayed pending.
              const flipped = await tx.reportSection.updateMany({
                where: { id: req.reportSectionId, status: "submitted" },
                data: {
                  status: "draft",
                  submittedAt: null,
                  revokedAt: new Date(),
                  revokedBy: decidedBy,
                },
              });
              if (flipped.count === 0) {
                // Stale approve: the section was already reopened elsewhere.
                // Make the request terminal (rejected + auto-note) so it leaves
                // the pending queue, flip nothing, and skew NO funnel metric —
                // an auto-close is not a real decision (the funnel stays
                // requested/approved/rejected).
                await tx.reopenRequest.update({
                  where: { id: req.id },
                  data: {
                    status: "rejected",
                    reviewedById: decidedBy,
                    reviewedAt: new Date(),
                    reviewNote:
                      "Auto-closed: the section was already reopened.",
                  },
                });
                return { kind: "stale" as const };
              }

              return {
                kind: "decided" as const,
                decision: "approved" as const,
              };
            });

            // Loser of a concurrent decision: changed nothing. A 409 CONFLICT
            // is the honest code (the request slipped out from under this call);
            // no funnel metric.
            if (outcome.kind === "already-processed") {
              throw new TRPCError({
                code: "CONFLICT",
                message: "Already processed.",
              });
            }
            // Stale auto-close: the request is now terminal and out of the
            // pending queue; report it without skewing the funnel.
            if (outcome.kind === "stale") {
              return {
                success: true as const,
                decision: "rejected" as const,
                staleAutoClosed: true as const,
              };
            }
            // Only a winning, real decision increments the
            // funnel, AFTER the transaction commits.
            customreportReopenRequestsTotal.inc({ state: outcome.decision });
            return {
              success: true as const,
              decision: outcome.decision,
              staleAutoClosed: false as const,
            };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      pendingReopenCount: headProcedure.query(async ({ ctx }) => {
        try {
          // reopen-request-lifecycle: same group scope as the list — a
          // head counts only its own group's pending requests; admin global.
          const scope = groupScopeFilter(ctx.session, "reportSection");
          const count = await deps.prisma.reopenRequest.count({
            where: { status: "pending", reportSection: scope },
          });
          return { count };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    }),

    // === Archive namespace ===
    // archive.list / archive.detail use anyRoleProcedure
    // because heads, leads, admins, and viewers all consume this surface but
    // with different row visibility. The Prisma `where` filter at the service
    // layer (driven by ctx.session.role) is the actual gate — viewers can
    // only ever see published reports.
    archive: router({
      list: anyRoleProcedure
        .input(paginationInputSchema.optional())
        .query(async ({ input, ctx }) => {
          try {
            return await deps.archiveService.listArchiveReports(
              input,
              ctx.session.role,
              ctx.session,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      detail: anyRoleProcedure
        .input(z.object({ reportId: z.uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            const detail = await deps.archiveService.getArchiveReport(
              input.reportId,
              ctx.session.role,
              ctx.session,
            );
            // Probe detection — non-admin fetched a report but group
            // scope filtered out all sections. May false-positive on reports
            // that genuinely have no sections; acceptable given the low rate
            // of empty published reports in this domain.
            if (
              ctx.session.role !== "admin" &&
              detail.report.sections.length === 0
            ) {
              ctx.auditLogger.scopeDenied({
                userId: ctx.session.userId,
                role: ctx.session.role,
                ip: ctx.ip,
                attemptedScope: "reportSection",
                resourceId: input.reportId,
              });
            }
            return detail;
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Head-only mutation to move a published report into the archive.
       * Sets `archived=true` on the Report row via adminService.archivePeriod
       * (which uses Report.id — "period" and "report" are the same table).
       * After this call the report appears in archive.list and is no longer
       * shown in the "recently published" surface.
       */
      archiveReport: headProcedure
        .input(z.object({ reportId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            await deps.adminService.archivePeriod(input.reportId);
            return { success: true as const };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      /**
       * Head-only mutation to un-archive a report (move back to
       * "published but not archived"). Sets `archived=false` via
       * adminService.unarchivePeriod and removes it from archive.list.
       */
      unarchiveReport: headProcedure
        .input(z.object({ reportId: z.uuid() }))
        .mutation(async ({ input }) => {
          try {
            await deps.adminService.unarchivePeriod(input.reportId);
            return { success: true as const };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Reminders namespace ===
    reminders: router({
      execute: headProcedure
        .input(
          z.object({
            ruleId: z.uuid(),
            recipientEmail: z.email(),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            if (ctx.session.role !== "admin") {
              const reportId = await resolveScopedReminderReportId(
                deps.prisma,
                input.ruleId,
              );
              await assertReportHasInScopeSection(
                deps.prisma,
                ctx.session,
                reportId,
              );
              await assertDraftRecipientInScope(
                deps.prisma,
                ctx.session,
                reportId,
                input.recipientEmail,
              );
            }
            return await deps.remindersService.requestReminderExecution(
              input.ruleId,
              input.recipientEmail,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      listExecutions: headProcedure
        .input(
          z
            .object({ ruleId: z.uuid() })
            .extend(paginationInputSchema.partial().shape),
        )
        .query(async ({ input, ctx }) => {
          try {
            const { ruleId, cursor, limit } = input;
            const pagination =
              cursor || limit
                ? { cursor, limit: limit ?? DEFAULT_EXECUTION_LIST_LIMIT }
                : undefined;

            // Non-admins see only their group's recipient rows. The allowlist
            // is resolved here and applied inside the service BEFORE pagination
            // so out-of-scope rows cannot consume page size or drive nextCursor.
            const recipientAllowlist =
              ctx.session.role === "admin"
                ? null
                : await resolveInScopeRecipientEmails(
                    deps.prisma,
                    ctx.session,
                    ruleId,
                  );

            return await deps.remindersService.listExecutions(
              ruleId,
              pagination,
              recipientAllowlist,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // Manual "Send Reminder" trigger from the head dashboard alert bar.
      // Resolves the active reminder rule + draft-section authors server-side
      // (the client never sees lead emails) and dispatches one execution per
      // pending lead via the existing dedupe-keyed pipeline.
      dispatchPending: headProcedure
        .input(
          z.object({
            reportId: z.uuid(),
            ruleId: z.uuid().optional(),
            // Scope dispatch to a single lead so the
            // Head Dashboard Remind button can ping one author without
            // exposing emails to the client. When undefined, falls back to
            // the original "every draft author" behaviour used by the
            // bulk AlertBar action.
            leadId: z.uuid().optional(),
          }),
        )
        .output(
          z.object({
            dispatched: z.number().int().nonnegative(),
            alreadySent: z.number().int().nonnegative(),
            skipped: z.number().int().nonnegative(),
            reason: z.string().optional(),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            const activeReportId = ctx.session.activeReportId;
            if (!activeReportId || activeReportId !== input.reportId) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "report-not-active",
              });
            }
            // `activeReportId` is the globally-newest draft, NOT group-bounded, so
            // it alone does not prove the report is in the caller's scope. Require
            // an in-scope section on the report BEFORE resolving any rule, so an
            // out-of-scope report fails closed uniformly (with or without a
            // matching rule) and cannot be used to probe rule existence. Admin
            // (groupScopeFilter -> {}) is unaffected.
            if (ctx.session.role !== "admin") {
              await assertReportHasInScopeSection(
                deps.prisma,
                ctx.session,
                input.reportId,
              );
            }
            // A single-lead dispatch is authorized against the lead's User row
            // (group scope), not a section — preserving the no-section success
            // state below for an in-scope lead with no draft yet.
            if (input.leadId !== undefined) {
              await assertLeadInScope(deps.prisma, ctx.session, input.leadId);
            }
            const rule = await deps.prisma.reminderRule.findFirst({
              where: {
                reportId: input.reportId,
                status: "active",
                ...(input.ruleId ? { id: input.ruleId } : {}),
              },
              orderBy: { fireAt: "asc" },
            });
            if (!rule) {
              return {
                dispatched: 0,
                alreadySent: 0,
                skipped: 0,
                reason: "no-active-rule",
              };
            }
            const draftSections = await deps.prisma.reportSection.findMany({
              where: {
                reportId: input.reportId,
                status: "draft",
                ...(input.leadId ? { authorId: input.leadId } : {}),
                // Bulk dispatch only reaches the caller's own group's authors.
                ...groupScopeFilter(ctx.session, "reportSection"),
              },
              include: {
                author: { select: { email: true, notificationOptOut: true } },
              },
            });
            if (input.leadId !== undefined && draftSections.length === 0) {
              return {
                dispatched: 0,
                alreadySent: 0,
                skipped: 0,
                reason: "no-matching-section",
              };
            }
            // Race-safe attribution: call the service
            // first — it atomically inserts via the dedupeKey @unique index,
            // so two concurrent clicks never produce two emails. Then read
            // the execution back and compare `createdAt` to the call's
            // start. If it lies inside the call window it is genuinely new,
            // otherwise the service deduplicated against a prior dispatch.
            // A pre-read + service call would reintroduce a TOCTOU race where
            // both concurrent callers see `existing === null` and both
            // increment `dispatched`, mis-reporting the counter even
            // though only one email actually went out.
            const fireAtIso = rule.fireAt.toISOString();
            // eslint-disable-next-line no-restricted-syntax -- Race-safe dispatch accounting must stay beside the async dedupe call; a reducer would hide the TOCTOU boundary.
            let dispatched = 0;
            // eslint-disable-next-line no-restricted-syntax -- Race-safe dispatch accounting must stay beside the async dedupe call; a reducer would hide the TOCTOU boundary.
            let alreadySent = 0;
            // eslint-disable-next-line no-restricted-syntax -- Race-safe dispatch accounting must stay beside the async dedupe call; a reducer would hide the TOCTOU boundary.
            let skipped = 0;
            for (const sec of draftSections) {
              if (sec.author.notificationOptOut) {
                skipped++;
                continue;
              }
              const dedupeKey = `${rule.id}:${fireAtIso}:${sec.author.email}`;
              const beforeMs = Date.now();
              await deps.remindersService.requestReminderExecution(
                rule.id,
                sec.author.email,
              );
              const after = await deps.prisma.reminderExecution.findUnique({
                where: { dedupeKey },
                select: { createdAt: true },
              });
              if (after && after.createdAt.getTime() >= beforeMs) {
                dispatched++;
              } else {
                alreadySent++;
              }
            }
            return { dispatched, alreadySent, skipped };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Period lifecycle namespace (v4.0) ===
    period: router({
      publish: headProcedure
        .input(z.object({ reportId: z.uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.periodService.publishPeriod(
              input.reportId,
              ctx.session,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      reopen: headProcedure
        .input(z.object({ reportId: z.uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.periodService.reopenPeriod(
              input.reportId,
              ctx.session,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Weekly Report namespace (v4.0) ===
    // weeklyReport.get uses anyRoleProcedure because
    // viewers, leads, heads, and admins all consume this surface. The
    // service layer scopes the read to published periods for viewers.
    weeklyReport: router({
      get: anyRoleProcedure
        .input(z.object({ reportId: z.uuid().optional() }).optional())
        .query(async ({ input, ctx }) => {
          const requestedReportId = input?.reportId ?? null;
          try {
            const result = await deps.weeklyReportService.getWeeklyReport(
              input?.reportId,
              ctx.session.role,
              ctx.session,
            );
            // No-period is a normal 200 response, not an error path.
            if (result.status === "no-period") {
              ctx.logger.info("weekly report: no active period", {
                phase: WEEKLY_REPORT_LOAD_LOG_PHASE,
                procedure: WEEKLY_REPORT_GET_PROCEDURE,
                userId: ctx.session.userId,
                role: ctx.session.role,
                requestedReportId,
              });
              // crossGroup is an internal audit signal — strip before sending.
              const { crossGroup: _crossGroup, ...publicResult } = result;
              return publicResult;
            }
            // Emit scopeAccessed once when a non-admin read surfaces
            // cross-group products. crossGroup is internal — strip before return.
            const { crossGroup, ...publicResult } = result;
            if (
              crossGroup !== null &&
              ctx.session.role !== "admin" &&
              crossGroup.productIds.length > 0
            ) {
              ctx.auditLogger.scopeAccessed({
                userId: ctx.session.userId,
                role: ctx.session.role,
                ip: ctx.ip,
                accessedScope: "weeklyReport.project",
                productIds: crossGroup.productIds,
                groupIds: crossGroup.groupIds,
                resourceId: result.reportId,
              });
            }
            ctx.logger.info("weekly report load succeeded", {
              phase: WEEKLY_REPORT_LOAD_LOG_PHASE,
              procedure: WEEKLY_REPORT_GET_PROCEDURE,
              userId: ctx.session.userId,
              role: ctx.session.role,
              requestedReportId,
              resolvedReportId: result.reportId,
              periodStatus: result.periodStatus,
              submissionCount: result.submissionCount,
              totalLeads: result.totalLeads,
            });
            return publicResult;
          } catch (error) {
            const errorInfo =
              error instanceof Error
                ? { name: error.name, message: error.message }
                : { name: typeof error, message: String(error) };
            const logFailure =
              errorInfo.name === "WeeklyReportDomainError"
                ? ctx.logger.warn.bind(ctx.logger)
                : ctx.logger.error.bind(ctx.logger);
            logFailure("weekly report load failed", {
              phase: WEEKLY_REPORT_LOAD_LOG_PHASE,
              procedure: WEEKLY_REPORT_GET_PROCEDURE,
              userId: ctx.session.userId,
              role: ctx.session.role,
              requestedReportId,
              error: errorInfo,
            });
            throw mapDomainError(error);
          }
        }),
    }),

    // === Lead Form namespace (v4.0) ===
    leadForm: router({
      // Org-wide lead-form presentation flags. Read-only slice of AppSettings
      // (admin-managed via admin.updateSettings, like every other setting);
      // exposed to every authenticated role so the lead form can pick classic
      // vs unified view.
      viewSettings: protectedProcedure.query(async () => {
        try {
          const settings = await deps.adminService.getSettings();
          return { unifiedActivityView: settings.unifiedActivityView };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      byPeriod: protectedProcedure
        .input(
          z.object({
            reportId: z.uuid(),
            authorId: z.uuid().optional(),
          }),
        )
        .query(async ({ input, ctx }) => {
          try {
            const form = await deps.leadFormService.getByPeriod(
              input.reportId,
              ctx.session.userId,
              ctx.session.role,
              input.authorId,
            );
            ctx.logger.info("lead form load succeeded", {
              phase: "lead-form.load",
              procedure: "leadForm.byPeriod",
              userId: ctx.session.userId,
              role: ctx.session.role,
              reportId: input.reportId,
              requestedAuthorId: input.authorId ?? null,
              resolvedAuthorId: form.section.authorId,
              readOnly: form.readOnly,
            });
            return form;
          } catch (error) {
            const errorInfo =
              error instanceof Error
                ? { name: error.name, message: error.message }
                : { name: typeof error, message: String(error) };
            const logFailure =
              errorInfo.name === "LeadFormDomainError"
                ? ctx.logger.warn.bind(ctx.logger)
                : ctx.logger.error.bind(ctx.logger);
            logFailure("lead form load failed", {
              phase: "lead-form.load",
              procedure: "leadForm.byPeriod",
              userId: ctx.session.userId,
              role: ctx.session.role,
              reportId: input.reportId,
              requestedAuthorId: input.authorId ?? null,
              error: errorInfo,
            });
            throw mapDomainError(error);
          }
        }),

      fillFrom: protectedProcedure
        .input(
          z.object({
            targetSectionId: z.uuid(),
            sourceSectionId: z.uuid(),
            // Optimistic-concurrency expected version of the TARGET section.
            version: z.number().int().min(1),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.fillFrom(
              input.targetSectionId,
              input.sourceSectionId,
              ctx.session.userId,
              input.version,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // TODO(versions-v2): the version-history procedures (versions,
      // restoreVersion, getVersion, createSnapshot, setVersionPinned) are
      // deferred; re-add them when versions-v2 is designed.

      revoke: headProcedure
        .input(z.object({ reportSectionId: z.uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            // scope-leadform-revoke-authz: object-level authz — a head may only
            // revoke a section authored in its own group (admin scope is {}).
            // Mirrors the respondReopenRequest scoped re-load.
            return await deps.leadFormService.revokeSubmission(
              input.reportSectionId,
              ctx.session.userId,
              groupScopeFilter(ctx.session, "reportSection"),
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      revokeAllSubmitted: headProcedure
        .input(z.object({ reportId: z.uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            // scope-leadform-revoke-authz: bulk revoke is bounded to the head's
            // own group inside a multi-group report (admin scope is {} → global).
            return await deps.leadFormService.revokeAllSubmitted(
              input.reportId,
              ctx.session.userId,
              groupScopeFilter(ctx.session, "reportSection"),
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      requestReopen: protectedProcedure
        .input(
          z.object({
            reportSectionId: z.uuid(),
            reason: z.string().max(MAX_REOPEN_REASON_LENGTH).optional(),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.requestReopen(
              input.reportSectionId,
              ctx.session.userId,
              input.reason,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      crossAuthors: protectedProcedure
        .input(z.object({ reportId: z.uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.getCrossAuthors(
              input.reportId,
              ctx.session.userId,
              ctx.session.role,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // scope-lead-report-to-own-contribution — the lead form's
      // "Everyone" visibility lens. Full foreign content, gated by report
      // access AND product co-ownership for ALL callers (no head/admin
      // bypass); the role is intentionally NOT passed.
      crossAuthorContent: protectedProcedure
        .input(z.object({ reportId: z.uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.getCrossAuthorContent(
              input.reportId,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Analytics namespace ===
    // These procedures use anyRoleProcedure because heads, leads, admins, and
    // viewers all consume trend data. The repository layer enforces the
    // published-only floor (PUBLISHED_FLOOR mirrors archive.prisma-repository
    // pattern), so viewer sessions only ever see published-period rows.
    analytics: router({
      trafficLightHistory: anyRoleProcedure
        .input(trafficLightHistoryInputSchema)
        .query(async ({ input, ctx }) => {
          try {
            return await deps.analyticsService.trafficLightHistory(
              input,
              ctx.session,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
      leadVelocity: anyRoleProcedure
        .input(leadVelocityInputSchema)
        .query(async ({ input, ctx }) => {
          try {
            return await deps.analyticsService.leadVelocity(input, ctx.session);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
      periodComparison: anyRoleProcedure
        .input(periodComparisonInputSchema)
        .query(async ({ input, ctx }) => {
          try {
            return await deps.analyticsService.periodComparison(
              input,
              ctx.session,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Search namespace ===
    // Full-text search across Item / Risk / Decision / Project. The service
    // layer validates the input and gates `scope='all'` to head/admin via
    // SearchAuthorizationError; the router maps that to FORBIDDEN.
    //
    // protectedProcedure (any authenticated user) is the right baseline:
    // every authenticated session can search their own content
    // (`scope='mine'`); the role check inside the service is the gate that
    // matters. anyRoleProcedure would be equivalent here but the simpler
    // protectedProcedure mirrors the rest of the search-style read paths.
    search: router({
      query: protectedProcedure
        .input(searchQueryInputSchema)
        .query(async ({ input, ctx }) => {
          try {
            return await deps.searchService.query(input, ctx.session);
          } catch (error) {
            if (error instanceof SearchAuthorizationError) {
              ctx.auditLogger.scopeDenied({
                userId: ctx.session.userId,
                role: ctx.session.role,
                ip: ctx.ip,
                attemptedScope: "search",
                resourceId: input.q,
              });
              throw new TRPCError({
                code: "FORBIDDEN",
                message: error.message,
              });
            }
            throw mapDomainError(error);
          }
        }),
    }),

    // === Activity namespace ===
    // Live activity feed for the head/admin dashboard "Активность за
    // текущий период" panel. headProcedure — only heads (and admins,
    // aliased) consume the per-lead status snapshot.
    activity: router({
      live: headProcedure.query(async ({ ctx }) => {
        try {
          return await deps.activityService.getLiveActivity(ctx.session);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    }),

    // === Project Activity namespace ===
    // Admin provisioning of Project Activities — stage-less, group-scoped
    // reporting units beside products, with M:M lead attachment. Deliberately
    // NOT under `activity.*` (that namespace is the live-status feed above).
    // All procedures ride the canonical adminProcedure chain; attachment-group
    // and reference validation live in ProjectActivityService.
    projectActivity: router({
      list: adminProcedure.query(async () => {
        try {
          return await deps.projectActivityService.list();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      create: adminProcedure
        .input(projectActivityCreateSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.projectActivityService.create(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      update: adminProcedure
        .input(projectActivityUpdateSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.projectActivityService.update(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      archive: adminProcedure
        .input(projectActivityArchiveSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.projectActivityService.archive(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      attachLead: adminProcedure
        .input(projectActivityLeadEdgeSchema)
        .mutation(async ({ input }) => {
          try {
            await deps.projectActivityService.attachLead(input);
            return { success: true as const };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      detachLead: adminProcedure
        .input(projectActivityLeadEdgeSchema)
        .mutation(async ({ input }) => {
          try {
            await deps.projectActivityService.detachLead(input);
            return { success: true as const };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Telemetry namespace ===
    // Product-KPI surface for the in-app dashboard card. Authorised by
    // `leadershipProcedure` (head + admin + viewer); lead role is denied
    // because lead is the data subject of these KPIs, not a consumer.
    // Cached for 60s in Redis (see TelemetryCache); a Redis outage
    // degrades to direct queries.
    telemetry: router({
      summary: leadershipProcedure.query(async () => {
        try {
          if (!deps.telemetryService) {
            // Test-fixture mode (createAppRouter({}) for role-coverage
            // harnesses). Return a zero-shape payload that still parses
            // the shared schema so the role-coverage harness can hit
            // the surface without a 500.
            return {
              reportsThisPeriod: 0,
              onTimeRatio: null,
              activeLeads: 0,
              lateSections: 0,
              pendingReopens: 0,
              pdfExportsLast7d: 0,
              sparkline: [] as number[],
            };
          }
          return await deps.telemetryService.getSummary();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
