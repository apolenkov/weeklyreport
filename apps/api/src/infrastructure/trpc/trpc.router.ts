import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  draftSaveSchema,
  submitSectionSchema,
  myHistoryEntrySchema,
  paginationInputSchema,
  adminUserSchema,
  adminProjectSchema,
  reportingGroupSchema,
  reportPeriodSchema,
  adminReminderRuleSchema,
  appSettingsUpdateSchema,
  trafficLightHistoryInputSchema,
  leadVelocityInputSchema,
  periodComparisonInputSchema,
  searchQueryInputSchema,
  queueNameSchema,
} from "@customreport/shared";

import {
  router,
  publicProcedure,
  protectedProcedure,
  headProcedure,
  adminProcedure,
  anyRoleProcedure,
} from "./trpc.middleware.js";
import { mapDomainError } from "./trpc.error-mapper.js";

import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";

import type { ReportSectionsService } from "../../modules/report-sections/report-sections.service.js";
import type { ReviewService } from "../../modules/review/review.service.js";
import type { PublicationService } from "../../modules/publication/publication.service.js";
import type { PdfExportService } from "../../modules/pdf-export/pdf-export.service.js";
import type { AdminService } from "../../modules/admin/admin.service.js";
import type { JobsService } from "../../modules/admin/jobs.service.js";
import type { RemindersService } from "../../modules/reminders/reminders.service.js";
import type { CarryOverService } from "../../modules/carry-over/carry-over.service.js";
import type { ArchiveService } from "../../modules/archive/archive.service.js";
import type { PeriodService } from "../../modules/period/period.service.js";
import type { WeeklyReportService } from "../../modules/weekly-report/weekly-report.service.js";
import type { LeadFormService } from "../../modules/report-sections/lead-form.service.js";
import type { AnalyticsService } from "../../modules/analytics/analytics.service.js";
import type { AiService } from "../../modules/ai/ai.service.js";
import {
  SearchAuthorizationError,
  type SearchService,
} from "../../modules/search/search.service.js";
import type { ActivityService } from "../../modules/activity/activity.service.js";
import {
  assertCanReadReport,
  assertCanReadRisk,
  assertCanReadSection,
} from "../../modules/ai/ai-authz.js";

type RouterDeps = {
  prisma: PrismaClient;
  reportSectionsService: ReportSectionsService;
  reviewService: ReviewService;
  publicationService: PublicationService;
  pdfExportService: PdfExportService;
  adminService: AdminService;
  remindersService: RemindersService;
  carryOverService: CarryOverService;
  archiveService: ArchiveService;
  periodService: PeriodService;
  weeklyReportService: WeeklyReportService;
  leadFormService: LeadFormService;
  /**
   * Phase 30-01 (ANAL-01): analytics surface — traffic light history,
   * lead velocity, period comparison. Cached via Redis with prefix-wide
   * invalidation on PeriodService.publishPeriod / reopenPeriod.
   */
  analyticsService: AnalyticsService;
  /**
   * Phase 31 (AI-01/02/03): AI insights service — read-through cache via
   * AiInsight Prisma rows; sync surface for tRPC. Returns sentinel union
   * on outage / missing key / rate limit / budget exceeded.
   */
  aiService: AiService;
  /**
   * Phase 39-05 (PERF-05): full-text search across Item / Risk / Decision
   * / Project. tsvector + GIN, Russian text-search config. Role-gated
   * scope via SearchAuthorizationError → FORBIDDEN.
   */
  searchService: SearchService;
  /**
   * UX-18 (Phase 35-08): live activity feed for the head/admin dashboard
   * "Активность за текущий период" panel. One row per lead's section in
   * the open period, with section-level counts + last-edit timestamp.
   * Polled every 15s by the dashboard.
   */
  activityService: ActivityService;
  /**
   * NOTIF-06 (Phase 29-05): read-only BullMQ Queue handle used by
   * `admin.dlqCount` to surface failed-job count. Optional so existing test
   * fixtures can call createAppRouter(stubDeps) without instantiating Redis.
   */
  emailReminderQueue?: Queue;
  /**
   * Phase 35-06: BullMQ DLQ admin surface — `admin.jobs.listFailed` /
   * `admin.jobs.retryFailed`. Optional so test fixtures and the role-coverage
   * harness can build the router with `{}` deps; in that mode the service
   * is constructed locally from an undefined Queue and every call returns
   * an empty/no-op result.
   */
  jobsService?: JobsService;
};

export function createAppRouter(deps: RouterDeps) {
  return router({
    // === Auth namespace (v5.0 — AUTH-04) ===
    auth: router({
      me: publicProcedure.query(({ ctx }) => {
        // ctx.session is UserSession | null; null means unauthenticated.
        // Returning null lets the client distinguish "loaded, no session"
        // from "still loading" without throwing — preventing the 401
        // interceptor from triggering an immediate redirect on every load.
        return ctx.session;
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
        if (process.env["AUTH_DEV_MODE"] !== "true") {
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

      wipeAndReseed: protectedProcedure
        .input(
          z.object({
            variant: z
              .enum(["minimum", "advanced", "manual-uat"])
              .default("minimum"),
          }),
        )
        .mutation(async ({ input }) => {
          if (process.env["AUTH_DEV_MODE"] !== "true") {
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
          const advancedSeed = "pnpm exec prisma db seed";
          const simpleSeed =
            "pnpm --dir apps/api exec tsx ../../prisma/seed-simple.ts";
          const manualUatWipe =
            "pnpm --dir apps/api exec tsx ../../prisma/wipe-manual-uat.ts";
          const script =
            input.variant === "manual-uat"
              ? manualUatWipe
              : input.variant === "advanced"
                ? reset + " && " + advancedSeed
                : reset + " && " + simpleSeed;
          // Resolve repo root from this file (apps/api/src/.../trpc.router.ts).
          // The seed script needs to run with the monorepo root as cwd so
          // pnpm picks up the correct workspace.
          const path = await import("node:path");
          const url = await import("node:url");
          const __filename = url.fileURLToPath(import.meta.url);
          const repoRoot = path.resolve(
            path.dirname(__filename),
            "../../../../..",
          );
          try {
            const stdout = execSync(script, {
              cwd: repoRoot,
              encoding: "utf8",
              env: {
                ...process.env,
                PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
              },
              timeout: input.variant === "manual-uat" ? 60_000 : 120_000,
            });
            return {
              ok: true,
              variant: input.variant,
              output: stdout.split("\n").slice(-15).join("\n"),
            };
          } catch (error) {
            const stderr =
              error instanceof Error && "stderr" in error
                ? String((error as { stderr?: unknown }).stderr ?? "")
                : "";
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Reseed failed: ${error instanceof Error ? error.message : String(error)}\n${stderr.slice(-500)}`,
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
          orderBy: { createdAt: "desc" },
          include: {
            report: {
              select: {
                id: true,
                periodStart: true,
                periodEnd: true,
                status: true,
                publishedAt: true,
              },
            },
          },
        });

        return myHistoryEntrySchema.array().parse(
          sections.map((s) => ({
            sectionId: s.id,
            reportId: s.report.id,
            periodStart: s.report.periodStart,
            periodEnd: s.report.periodEnd,
            reportStatus: s.report.status,
            sectionStatus: s.status,
            submittedAt: s.submittedAt,
            publishedAt: s.report.publishedAt,
          })),
        );
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
      // AUTH-04 (Phase 28-01): review.dashboard hardened from protectedProcedure
      // → headProcedure. Defense-in-depth: only heads (and admins, aliased)
      // see the submission dashboard. assembledReport / publish were already
      // headProcedure.
      dashboard: headProcedure.query(async ({ ctx }) => {
        try {
          const activeReportId = ctx.session.activeReportId;

          if (!activeReportId) {
            return [];
          }

          return await deps.reviewService.getSubmissionDashboard(
            activeReportId,
            ctx.session,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      assembledReport: headProcedure.query(async ({ ctx }) => {
        try {
          const activeReportId = ctx.session.activeReportId;

          if (!activeReportId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No active report in session.",
            });
          }

          return await deps.publicationService.getAssembledReport(
            activeReportId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      publish: headProcedure.mutation(async ({ ctx }) => {
        try {
          const activeReportId = ctx.session.activeReportId;

          if (!activeReportId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No active report in session.",
            });
          }

          return await deps.publicationService.publishReport(
            activeReportId,
            ctx.session,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    }),

    // === PDF Export namespace ===
    pdfExport: router({
      request: headProcedure
        .input(z.object({ reportId: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            // Phase 23-01: thread session userId so the pdf_export_jobs row
            // attributes the request to the head, not 'system'.
            return await deps.pdfExportService.requestPdfExport(
              input.reportId,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      status: headProcedure
        .input(z.object({ jobId: z.string().uuid() }))
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
        .input(z.object({ groupId: z.string().uuid() }))
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

      saveReminderRule: adminProcedure
        .input(adminReminderRuleSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.upsertReminderRule(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteUser: adminProcedure
        .input(z.object({ userId: z.string().uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.removeUser(input.userId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteProject: adminProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.removeProject(input.projectId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteReminderRule: adminProcedure
        .input(z.object({ ruleId: z.string().uuid() }))
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
            userId: z.string().uuid(),
            stageId: z.string().uuid(),
            projectId: z.string().uuid(),
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
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.deleteStageAssignment(input.id);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      listStageAssignments: adminProcedure
        .input(z.object({ projectId: z.string().uuid() }))
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

      // NOTIF-06 (Phase 29-05): BullMQ DLQ count — failed-jobs set of the
      // email-reminder queue. adminProcedure (admin/head only — D-AUTH-03).
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

      // v8.1: queryable in-app mutation audit history. The log rows are
      // written by mutationAuditMiddleware and keyed by the same correlation id
      // as the structured app.log line for support/debug lookups.
      actionLog: router({
        list: adminProcedure
          .input(
            z
              .object({
                limit: z.number().int().min(1).max(100).default(50),
              })
              .optional(),
          )
          .query(async ({ input }) => {
            try {
              const rows = await deps.prisma.userActionLog.findMany({
                orderBy: { createdAt: "desc" },
                take: input?.limit ?? 50,
              });
              return {
                rows: rows.map((row) => ({
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
              };
            } catch (error) {
              throw mapDomainError(error);
            }
          }),
      }),

      // Phase 35-06: BullMQ DLQ admin surface. Lifts the Bull Board view
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
              limit: z.number().int().min(1).max(200).optional(),
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
      // the Admin Panel "Reopen Requests" tab consumes these procedures.
      listReopenRequests: adminProcedure
        .input(
          z
            .object({
              status: z
                .enum(["pending", "approved", "rejected", "all"])
                .default("pending"),
            })
            .optional(),
        )
        .query(async ({ input }) => {
          try {
            const status = input?.status ?? "pending";
            const where = status === "all" ? {} : { status };
            const rows = await deps.prisma.reopenRequest.findMany({
              where,
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

      respondReopenRequest: adminProcedure
        .input(
          z.object({
            id: z.string().uuid(),
            decision: z.enum(["approved", "rejected"]),
            note: z.string().max(500).optional(),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            const req = await deps.prisma.reopenRequest.findUnique({
              where: { id: input.id },
              include: { reportSection: true },
            });
            if (!req) throw new Error("Reopen request not found.");
            if (req.status !== "pending") throw new Error("Already processed.");

            return await deps.prisma.$transaction(async (tx) => {
              await tx.reopenRequest.update({
                where: { id: input.id },
                data: {
                  status: input.decision,
                  reviewedById: ctx.session.userId,
                  reviewedAt: new Date(),
                  reviewNote: input.note?.trim() ? input.note.trim() : null,
                },
              });

              // Approve = flip the section back to draft + clear submittedAt
              // so the lead can edit again. The section's revokedAt/revokedBy
              // mirror the existing /head/report revoke flow for audit.
              if (input.decision === "approved") {
                await tx.reportSection.update({
                  where: { id: req.reportSectionId },
                  data: {
                    status: "draft",
                    submittedAt: null,
                    revokedAt: new Date(),
                    revokedBy: ctx.session.userId,
                  },
                });
              }

              return { success: true as const, decision: input.decision };
            });
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      pendingReopenCount: adminProcedure.query(async () => {
        try {
          const count = await deps.prisma.reopenRequest.count({
            where: { status: "pending" },
          });
          return { count };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    }),

    // === Archive namespace ===
    // AUTH-04 (Phase 28-01): archive.list / archive.detail use anyRoleProcedure
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
        .input(z.object({ reportId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await deps.archiveService.getArchiveReport(
              input.reportId,
              ctx.session.role,
              ctx.session,
            );
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
            ruleId: z.string().uuid(),
            recipientEmail: z.string().email(),
          }),
        )
        .mutation(async ({ input }) => {
          try {
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
            .object({ ruleId: z.string().uuid() })
            .merge(paginationInputSchema.partial()),
        )
        .query(async ({ input }) => {
          try {
            const { ruleId, cursor, limit } = input;
            const pagination =
              cursor || limit ? { cursor, limit: limit ?? 20 } : undefined;

            return await deps.remindersService.listExecutions(
              ruleId,
              pagination,
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
            reportId: z.string().uuid(),
            ruleId: z.string().uuid().optional(),
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
        .mutation(async ({ input }) => {
          try {
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
              where: { reportId: input.reportId, status: "draft" },
              include: {
                author: { select: { email: true, notificationOptOut: true } },
              },
            });
            // Compute the dedupeKey shape requestReminderExecution would derive
            // for the legacy (no-payload) path — `${rule.id}:${fireAt}:${email}`
            // — and look up existing executions BEFORE calling the service so
            // we can tell new dispatches apart from dedupe hits. Without this,
            // every click reported "Reminder sent" even when the cron-driven
            // scheduler had already sent the same recipient inside the cycle.
            const fireAtIso = rule.fireAt.toISOString();
            let dispatched = 0;
            let alreadySent = 0;
            let skipped = 0;
            for (const sec of draftSections) {
              if (sec.author.notificationOptOut) {
                skipped++;
                continue;
              }
              const dedupeKey = `${rule.id}:${fireAtIso}:${sec.author.email}`;
              const existing = await deps.prisma.reminderExecution.findUnique({
                where: { dedupeKey },
              });
              await deps.remindersService.requestReminderExecution(
                rule.id,
                sec.author.email,
              );
              if (existing) alreadySent++;
              else dispatched++;
            }
            return { dispatched, alreadySent, skipped };
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === CarryOver namespace ===
    carryOver: router({
      execute: headProcedure
        .input(
          z.object({
            sourceReportId: z.string().uuid(),
            targetReportId: z.string().uuid(),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            return await deps.carryOverService.executeCarryOver(
              input.sourceReportId,
              input.targetReportId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Period lifecycle namespace (v4.0) ===
    period: router({
      publish: headProcedure
        .input(z.object({ reportId: z.string().uuid() }))
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
        .input(z.object({ reportId: z.string().uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.periodService.reopenPeriod(input.reportId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Weekly Report namespace (v4.0) ===
    // AUTH-04 (Phase 28-01): weeklyReport.get uses anyRoleProcedure because
    // viewers, leads, heads, and admins all consume this surface. The
    // service layer scopes the read to published periods for viewers.
    weeklyReport: router({
      get: anyRoleProcedure
        .input(z.object({ reportId: z.string().uuid().optional() }).optional())
        .query(async ({ input, ctx }) => {
          const requestedReportId = input?.reportId ?? null;
          try {
            const report = await deps.weeklyReportService.getWeeklyReport(
              input?.reportId,
              ctx.session.role,
            );
            ctx.logger.info("weekly report load succeeded", {
              phase: "weekly-report.load",
              procedure: "weeklyReport.get",
              userId: ctx.session.userId,
              role: ctx.session.role,
              requestedReportId,
              resolvedReportId: report.reportId,
              periodStatus: report.periodStatus,
              submissionCount: report.submissionCount,
              totalLeads: report.totalLeads,
            });
            return report;
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
              phase: "weekly-report.load",
              procedure: "weeklyReport.get",
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
      byPeriod: protectedProcedure
        .input(
          z.object({
            reportId: z.string().uuid(),
            authorId: z.string().uuid().optional(),
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
            targetSectionId: z.string().uuid(),
            sourceSectionId: z.string().uuid(),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.fillFrom(
              input.targetSectionId,
              input.sourceSectionId,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      versions: protectedProcedure
        .input(z.object({ reportSectionId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.listVersions(
              input.reportSectionId,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      restoreVersion: protectedProcedure
        .input(
          z.object({
            reportSectionId: z.string().uuid(),
            version: z.number().int().positive(),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.restoreVersion(
              input.reportSectionId,
              input.version,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      createSnapshot: protectedProcedure
        .input(z.object({ reportSectionId: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.createSnapshot(
              input.reportSectionId,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      revoke: headProcedure
        .input(z.object({ reportSectionId: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.revokeSubmission(
              input.reportSectionId,
              ctx.session.userId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      requestReopen: protectedProcedure
        .input(
          z.object({
            reportSectionId: z.string().uuid(),
            reason: z.string().max(500).optional(),
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
    }),

    // === Analytics namespace (Phase 30-01..02) ===
    // ANAL-01..03 use anyRoleProcedure because heads, leads, admins, and
    // viewers all consume trend data. The repository layer enforces the
    // published-only floor (PUBLISHED_FLOOR mirrors archive.prisma-repository
    // pattern), so viewer sessions only ever see published-period rows.
    analytics: router({
      trafficLightHistory: anyRoleProcedure
        .input(trafficLightHistoryInputSchema)
        .query(async ({ input }) => {
          try {
            return await deps.analyticsService.trafficLightHistory(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
      leadVelocity: anyRoleProcedure
        .input(leadVelocityInputSchema)
        .query(async ({ input }) => {
          try {
            return await deps.analyticsService.leadVelocity(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
      periodComparison: anyRoleProcedure
        .input(periodComparisonInputSchema)
        .query(async ({ input }) => {
          try {
            return await deps.analyticsService.periodComparison(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Search namespace (Phase 39-05 — PERF-05) ===
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
            return await deps.searchService.query(input, {
              userId: ctx.session.userId,
              role: ctx.session.role,
            });
          } catch (error) {
            if (error instanceof SearchAuthorizationError) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: error.message,
              });
            }
            throw mapDomainError(error);
          }
        }),
    }),

    // === Activity namespace (UX-18, Phase 35-08) ===
    // Live activity feed for the head/admin dashboard "Активность за
    // текущий период" panel. headProcedure — only heads (and admins,
    // aliased) consume the per-lead status snapshot.
    activity: router({
      live: headProcedure.query(async () => {
        try {
          return await deps.activityService.getLiveActivity();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    }),

    // === AI Insights namespace (Phase 31 — AI-01/02/03) ===
    // ai.* procedures are excluded from loggingMiddleware (PITFALLS C-3 /
    // AI-SPEC §5.3). The service returns a discriminated-union sentinel
    // so the tRPC error mapper never sees raw SDK exceptions.
    //
    // Phase 32-A3 (M-02): each procedure asserts the caller can read the
    // requested resource before invoking AiService. Visibility mirrors the
    // archive PUBLISHED_FLOOR pattern: viewer → published-only;
    // head/admin → all; lead → published OR sections they author.
    // Throws FORBIDDEN before any Anthropic call (combines with C-01's
    // budget guard so authentication-only abuse cannot drive spend).
    ai: router({
      // AI-01: executive summary card on assembled report.
      summary: protectedProcedure
        .input(z.object({ reportId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            await assertCanReadReport(deps.prisma, ctx.session, input.reportId);
            return await deps.aiService.summary(input.reportId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
      // AI-01: head-only Regenerate button.
      regenerateSummary: headProcedure
        .input(z.object({ reportId: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            await assertCanReadReport(deps.prisma, ctx.session, input.reportId);
            return await deps.aiService.regenerateSummary(input.reportId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
      // AI-02: per-Risk sentiment classification badge.
      sentiment: protectedProcedure
        .input(z.object({ riskId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            await assertCanReadRisk(deps.prisma, ctx.session, input.riskId);
            return await deps.aiService.sentiment(input.riskId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
      // AI-03: per-cell on-track advisory verdict (✓ ⚠ ✗).
      // Advisory only — never replaces lead's chosen traffic-light colour.
      onTrack: protectedProcedure
        .input(
          z.object({
            sectionId: z.string().uuid(),
            projectId: z.string().uuid(),
          }),
        )
        .query(async ({ input, ctx }) => {
          try {
            await assertCanReadSection(
              deps.prisma,
              ctx.session,
              input.sectionId,
            );
            return await deps.aiService.onTrack(
              input.sectionId,
              input.projectId,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
