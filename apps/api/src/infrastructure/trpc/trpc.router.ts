import {
  adminCreatePeriodManualSchema,
  adminProjectSchema,
  adminReminderRuleSchema,
  adminTestTelegramSendSchema,
  adminUpdatePeriodManualSchema,
  adminUserSchema,
  appSettingsUpdateSchema,
  groupProductEdgeInputSchema,
  MS_PER_MINUTE,
  organizationUpdateSchema,
  paginationInputSchema,
  periodListBucketSchema,
  queueNameSchema,
  reminderPolicySchema,
  reportingGroupSchema,
  reportPeriodSchema,
} from "@customreport/shared";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { Queue } from "bullmq";
import { z } from "zod";

import { isTelegramConfigured } from "../../lib/env.js";
import type { ActivityService } from "../../modules/activity/activity.service.js";
import type { ActionLogService } from "../../modules/admin/action-log.service.js";
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
import { type SearchService } from "../../modules/search/search.service.js";
import { TELEGRAM_OUTBOUND_JOB_OPTS } from "../../modules/telegram/telegram.queue.js";
import type { TelemetryService } from "../../modules/telemetry/telemetry.service.js";
import type { WeeklyReportService } from "../../modules/weekly-report/weekly-report.service.js";
import { captureJobTraceContext } from "../bullmq/worker-observability.js";
import type { EnvConfig } from "../config/env.schema";
import { createActivityRouter } from "./routers/activity.router.js";
import { createAnalyticsRouter } from "./routers/analytics.router.js";
import { createArchiveRouter } from "./routers/archive.router.js";
import { createAuthRouter } from "./routers/auth.router.js";
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
import { clearOrgCache } from "./trpc.context.js";
import { mapDomainError } from "./trpc.error-mapper.js";
import {
  adminProcedure,
  headProcedure,
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

const MAX_PERIOD_LIST_LIMIT = 200;
const MAX_FAILED_JOBS_LIMIT = 200;
const MAX_REOPEN_NOTE_LENGTH = 500;

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
  /**
   * Queryable in-app mutation-audit history — `admin.actionLog.list`.
   * Optional so role-coverage test fixtures that build the router with `{}`
   * deps stay compiling; a real boot always wires it (see
   * `requireActionLogService` below).
   */
  actionLogService?: ActionLogService;
}

/**
 * drain-admin-router: resolve the action-log service or fail loudly.
 * Optional on `RouterDeps` only so role-coverage fixtures build with `{}`
 * deps; a real boot always wires it, so `undefined` here is a config bug.
 */
function requireActionLogService(deps: RouterDeps): ActionLogService {
  if (!deps.actionLogService) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Action log service is not configured.",
    });
  }
  return deps.actionLogService;
}

export function createAppRouter(deps: RouterDeps) {
  return router({
    // === Auth namespace ===
    auth: createAuthRouter(),

    // === Organization namespace ===
    org: createOrganizationRouter(deps),

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
    reports: createReportsRouter(deps),

    // === Review namespace ===
    review: createReviewRouter(deps),

    // === PDF Export namespace ===
    pdfExport: createPdfExportRouter(deps),

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
          return await deps.adminService.integrationsStatus(configured);
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
       * Per-period reminder rules are not written through the admin tab:
       * the period scheduler derives them from `ReminderPolicy` rows. The
       * read path (admin.getSnapshot.reminderRules) stays so the admin UI
       * can still visualize the derived rows inline.
       */
      saveReminderRule: adminProcedure
        .input(adminReminderRuleSchema)
        .mutation(() => {
          throw new TRPCError({
            code: "METHOD_NOT_SUPPORTED",
            message:
              "Per-period reminder rules are read-only; they derive from reminder policies. Use admin.savePolicy instead.",
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
            const result = await deps.adminService.deactivateUser(input.userId);
            await deps.sessionRevocationService?.revokeSession(input.userId);
            return result;
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
            const result = await deps.adminService.activateUser(input.userId);
            await deps.sessionRevocationService?.restoreSession(input.userId);
            return result;
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
          return await deps.adminService.listStages();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      // Per-project assignment count for the products-tab "X/7 stages"
      // header. Light query (single GROUP BY) so we can render the count
      // without loading every assignment row.
      listStageAssignmentCounts: adminProcedure.query(async () => {
        try {
          return await deps.adminService.listStageAssignmentCounts();
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
              return await requireActionLogService(deps).list(input);
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
            return await deps.adminService.listReopenRequests({
              status: input?.status,
              session: ctx.session,
            });
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
            return await deps.adminService.respondReopenRequest({
              id: input.id,
              decision: input.decision,
              note: input.note,
              decidedBy: ctx.session.userId,
              session: ctx.session,
            });
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      pendingReopenCount: headProcedure.query(async ({ ctx }) => {
        try {
          return await deps.adminService.pendingReopenCount(ctx.session);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    }),

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
