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
} from '@customreport/shared';

import { router, protectedProcedure, headProcedure } from './trpc.middleware.js';
import { mapDomainError } from './trpc.error-mapper.js';

import type { PrismaClient } from '@prisma/client';

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
};

export function createAppRouter(deps: RouterDeps) {
  return router({
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
      dashboard: protectedProcedure.query(async ({ ctx }) => {
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
        .mutation(async ({ input }) => {
          try {
            return await deps.pdfExportService.requestPdfExport(input.reportId);
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
    }),

    // === Archive namespace ===
    archive: router({
      list: protectedProcedure
        .input(paginationInputSchema.optional())
        .query(async ({ input }) => {
          try {
            return await deps.archiveService.listArchiveReports(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      detail: protectedProcedure
        .input(z.object({ reportId: z.string().uuid() }))
        .query(async ({ input }) => {
          try {
            return await deps.archiveService.getArchiveReport(input.reportId);
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
    weeklyReport: router({
      get: protectedProcedure
        .input(z.object({ reportId: z.string().uuid().optional() }).optional())
        .query(async ({ input }) => {
          try {
            return await deps.weeklyReportService.getWeeklyReport(input?.reportId);
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
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
