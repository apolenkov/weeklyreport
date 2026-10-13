import { TRPCError } from "@trpc/server";
import {
  compiledHistoryInputSchema,
  draftSaveSchema,
  paginationInputSchema,
  submitSectionSchema,
  type UserSession,
} from "@weeklyreport/shared";
import { assertRole } from "@weeklyreport/shared/trpc";

import type { ReportSectionsService } from "../../../modules/report-sections/index.js";
import type { WeeklyReportService } from "../../../modules/weekly-report/index.js";
import type { TrpcContext } from "../trpc.context.js";
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

// Viewer may retain authorship after demotion; content writes still require
// a writer role (openspec/specs/report-section-write-gates).
function assertContentWriter(
  ctx: Pick<TrpcContext, "auditLogger" | "ip"> & {
    readonly session: UserSession;
  },
): void {
  const allowed = ["lead", "head", "admin"] satisfies UserSession["role"][];
  try {
    assertRole(ctx.session, allowed);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      ctx.auditLogger.roleDenied({
        userId: ctx.session.userId,
        role: ctx.session.role,
        attemptedRole: allowed,
        ip: ctx.ip,
      });
    }
    throw error;
  }
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

    myHistory: protectedProcedure
      .input(paginationInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          return await deps.reportSectionsService.myHistory(
            ctx.session.userId,
            input,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    saveDraft: protectedProcedure
      .input(draftSaveSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ input, ctx }) => {
        try {
          assertContentWriter(ctx);
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
          assertContentWriter(ctx);
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
