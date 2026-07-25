import { paginationInputSchema } from "@customreport/shared";
import { z } from "zod";

import type { PeriodAdminService } from "../../../modules/admin/index.js";
import type { ArchiveService } from "../../../modules/archive/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { anyRoleProcedure, headProcedure, router } from "../trpc.middleware.js";

export interface ArchiveRouterDeps {
  archiveService: ArchiveService;
  periodAdminService: PeriodAdminService;
}

// anyRoleProcedure: service-layer where (by role) is the real gate; viewers
// only ever see published reports.

export function createArchiveRouter(deps: ArchiveRouterDeps) {
  return router({
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
          // Empty sections after group-scope filter: likely a probe; rare
          // genuine empty published reports are an acceptable false-positive.
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

    archiveReport: headProcedure
      .input(z.object({ reportId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          await deps.periodAdminService.archivePeriod(input.reportId);
          return { success: true as const };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    unarchiveReport: headProcedure
      .input(z.object({ reportId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          await deps.periodAdminService.unarchivePeriod(input.reportId);
          return { success: true as const };
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}
