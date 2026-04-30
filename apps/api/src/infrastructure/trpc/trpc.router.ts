import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  draftSaveSchema,
  submitSectionSchema,
  myHistoryEntrySchema,
  paginationInputSchema,
  adminUserSchema,
  adminProjectSchema,
  reportPeriodSchema,
  adminReminderRuleSchema,
  appSettingsUpdateSchema,
  trafficLightHistoryInputSchema,
  leadVelocityInputSchema,
  periodComparisonInputSchema,
} from '@customreport/shared';

import {
  router,
  publicProcedure,
  protectedProcedure,
  headProcedure,
  anyRoleProcedure,
} from './trpc.middleware.js';
import { mapDomainError } from './trpc.error-mapper.js';

import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';

import type { ReportSectionsService } from '../../modules/report-sections/report-sections.service.js';
import type { ReviewService } from '../../modules/review/review.service.js';
import type { PublicationService } from '../../modules/publication/publication.service.js';
import type { PdfExportService } from '../../modules/pdf-export/pdf-export.service.js';
import type { AdminService } from '../../modules/admin/admin.service.js';
import type { RemindersService } from '../../modules/reminders/reminders.service.js';
import type { CarryOverService } from '../../modules/carry-over/carry-over.service.js';
import type { ArchiveService } from '../../modules/archive/archive.service.js';
import type { PeriodService } from '../../modules/period/period.service.js';
import type { WeeklyReportService } from '../../modules/weekly-report/weekly-report.service.js';
import type { LeadFormService } from '../../modules/report-sections/lead-form.service.js';
import type { AnalyticsService } from '../../modules/analytics/analytics.service.js';

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
   * NOTIF-06 (Phase 29-05): read-only BullMQ Queue handle used by
   * `admin.dlqCount` to surface failed-job count. Optional so existing test
   * fixtures can call createAppRouter(stubDeps) without instantiating Redis.
   */
  emailReminderQueue?: Queue;
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
          orderBy: { createdAt: 'desc' },
          include: {
            report: { select: { id: true, periodStart: true, periodEnd: true, status: true, publishedAt: true } },
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
        .mutation(async ({ input }) => {
          try {
            return await deps.reportSectionsService.saveDraft(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      submit: protectedProcedure
        .input(submitSectionSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.reportSectionsService.submitSection(input);
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

          return await deps.reviewService.getSubmissionDashboard(activeReportId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      assembledReport: headProcedure.query(async ({ ctx }) => {
        try {
          const activeReportId = ctx.session.activeReportId;

          if (!activeReportId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'No active report in session.' });
          }

          return await deps.publicationService.getAssembledReport(activeReportId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      publish: headProcedure.mutation(async ({ ctx }) => {
        try {
          const activeReportId = ctx.session.activeReportId;

          if (!activeReportId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'No active report in session.' });
          }

          return await deps.publicationService.publishReport(activeReportId, ctx.session);
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

      status: protectedProcedure
        .input(z.object({ jobId: z.string().uuid() }))
        .query(async ({ input }) => {
          try {
            return await deps.pdfExportService.getPdfExportStatus(input.jobId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Admin namespace ===
    admin: router({
      snapshot: headProcedure.query(async () => {
        try {
          return await deps.adminService.getSnapshot();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      getSettings: headProcedure.query(async () => {
        try {
          return await deps.adminService.getSettings();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

      updateSettings: headProcedure
        .input(appSettingsUpdateSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.updateSettings(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      saveUser: headProcedure
        .input(adminUserSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.upsertUser(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      saveProject: headProcedure
        .input(adminProjectSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.upsertProject(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      savePeriod: headProcedure
        .input(reportPeriodSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.upsertPeriod(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      saveReminderRule: headProcedure
        .input(adminReminderRuleSchema)
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.upsertReminderRule(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteUser: headProcedure
        .input(z.object({ userId: z.string().uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.removeUser(input.userId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteProject: headProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.removeProject(input.projectId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteReminderRule: headProcedure
        .input(z.object({ ruleId: z.string().uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.removeReminderRule(input.ruleId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      saveStageAssignment: headProcedure
        .input(z.object({
          userId: z.string().uuid(),
          stageId: z.string().uuid(),
          projectId: z.string().uuid(),
        }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.saveStageAssignment(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      deleteStageAssignment: headProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          try {
            return await deps.adminService.deleteStageAssignment(input.id);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      listStageAssignments: headProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .query(async ({ input }) => {
          try {
            return await deps.adminService.listStageAssignments(input.projectId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      // NOTIF-06 (Phase 29-05): BullMQ DLQ count — failed-jobs set of the
      // email-reminder queue. headProcedure (admin/head only — D-AUTH-03).
      // Returns { count: 0 } when the Queue handle is absent (e.g. unit test
      // wiring) so the procedure is always callable.
      dlqCount: headProcedure.query(async () => {
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
            return await deps.archiveService.listArchiveReports(input, ctx.session.role);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      detail: anyRoleProcedure
        .input(z.object({ reportId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await deps.archiveService.getArchiveReport(input.reportId, ctx.session.role);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Reminders namespace ===
    reminders: router({
      execute: headProcedure
        .input(z.object({ ruleId: z.string().uuid(), recipientEmail: z.string().email() }))
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
        .input(z.object({ ruleId: z.string().uuid() }).merge(paginationInputSchema.partial()))
        .query(async ({ input }) => {
          try {
            const { ruleId, cursor, limit } = input;
            const pagination = cursor || limit ? { cursor, limit: limit ?? 20 } : undefined;

            return await deps.remindersService.listExecutions(ruleId, pagination);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === CarryOver namespace ===
    carryOver: router({
      execute: headProcedure
        .input(z.object({ sourceReportId: z.string().uuid(), targetReportId: z.string().uuid() }))
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
            return await deps.periodService.publishPeriod(input.reportId, ctx.session);
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
          try {
            return await deps.weeklyReportService.getWeeklyReport(
              input?.reportId,
              ctx.session.role,
            );
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // === Lead Form namespace (v4.0) ===
    leadForm: router({
      byPeriod: protectedProcedure
        .input(z.object({ reportId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.getByPeriod(input.reportId, ctx.session.userId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      fillFrom: protectedProcedure
        .input(z.object({ targetSectionId: z.string().uuid(), sourceSectionId: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.fillFrom(input.targetSectionId, input.sourceSectionId, ctx.session.userId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      versions: protectedProcedure
        .input(z.object({ reportSectionId: z.string().uuid() }))
        .query(async ({ input }) => {
          try {
            return await deps.leadFormService.listVersions(input.reportSectionId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      restoreVersion: protectedProcedure
        .input(z.object({ reportSectionId: z.string().uuid(), version: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.restoreVersion(input.reportSectionId, input.version, ctx.session.userId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      revoke: headProcedure
        .input(z.object({ reportSectionId: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.revokeSubmission(input.reportSectionId, ctx.session.userId);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      requestReopen: protectedProcedure
        .input(z.object({ reportSectionId: z.string().uuid(), reason: z.string().max(500).optional() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await deps.leadFormService.requestReopen(input.reportSectionId, ctx.session.userId, input.reason);
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
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
