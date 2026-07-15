import {
  compiledHistoryInputSchema,
  draftSaveSchema,
  submitSectionSchema,
} from "@customreport/shared";

import type { ReportSectionsService } from "../../../modules/report-sections/index.js";
import type { WeeklyReportService } from "../../../modules/weekly-report/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import {
  anyRoleProcedure,
  protectedProcedure,
  router,
} from "../trpc.middleware.js";

export interface ReportsRouterDeps {
  reportSectionsService: ReportSectionsService;
  weeklyReportService: WeeklyReportService;
}

export function createReportsRouter(deps: ReportsRouterDeps) {
  return router({
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
      try {
        return await deps.reportSectionsService.myHistory(ctx.session.userId);
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

    compiledHistory: anyRoleProcedure
      .input(compiledHistoryInputSchema.optional())
      .query(async ({ input, ctx }) => {
        try {
          const includeArchive = input?.includeArchive ?? false;
          return await deps.weeklyReportService.compiledHistory(
            ctx.session,
            includeArchive,
          );
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
        return await deps.weeklyReportService.latestForViewer(ctx.session);
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
  });
}
