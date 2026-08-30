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
  captureMutationAuditInputMiddleware,
  protectedProcedure,
  router,
} from "../trpc.middleware.js";

export interface ReportsRouterDeps {
  readonly reportSectionsService: ReportSectionsService;
  readonly weeklyReportService: WeeklyReportService;
}

function createSectionProcedures(deps: ReportsRouterDeps) {
  return {
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

    saveDraft: protectedProcedure
      .input(draftSaveSchema)
      .use(captureMutationAuditInputMiddleware)
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
      .use(captureMutationAuditInputMiddleware)
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
  };
}

function createReportNavigationProcedures(deps: ReportsRouterDeps) {
  return {
    // Status-target resolution rules: openspec/specs/viewer-report-navigation.
    // A lead resolves their own authored sections.
    latestForViewer: anyRoleProcedure.query(async ({ ctx }) => {
      try {
        return await deps.weeklyReportService.latestForViewer(ctx.session);
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
  };
}

export function createReportsRouter(deps: ReportsRouterDeps) {
  return router({
    ...createSectionProcedures(deps),
    ...createReportNavigationProcedures(deps),
  });
}
