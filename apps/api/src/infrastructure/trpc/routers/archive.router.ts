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

const reportIdInput = z.object({ reportId: z.uuid() });

// anyRoleProcedure: service-layer where (by role) is the real gate; viewers
// only ever see published reports.

function buildListProcedure(deps: ArchiveRouterDeps) {
  return anyRoleProcedure
    .input(paginationInputSchema.optional())
    .query(async ({ input, ctx }) => {
      try {
        return await deps.archiveService.listArchiveReports(input, ctx.session);
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

function buildDetailProcedure(deps: ArchiveRouterDeps) {
  return anyRoleProcedure.input(reportIdInput).query(async ({ input, ctx }) => {
    try {
      const { detail, totalSectionCount } =
        await deps.archiveService.getArchiveReport(input.reportId, ctx.session);
      // Zero scoped sections with sections present in the report = the caller
      // is scoped out of every one; a genuinely section-less report is not a
      // denial, so empty data must not read as denied.
      if (
        ctx.session.role !== "admin" &&
        detail.report.sections.length === 0 &&
        totalSectionCount > 0
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
  });
}

function buildArchiveReportProcedure(deps: ArchiveRouterDeps) {
  return headProcedure.input(reportIdInput).mutation(async ({ input }) => {
    try {
      await deps.periodAdminService.archivePeriod(input.reportId);
      return { success: true as const };
    } catch (error) {
      throw mapDomainError(error);
    }
  });
}

function buildUnarchiveReportProcedure(deps: ArchiveRouterDeps) {
  return headProcedure.input(reportIdInput).mutation(async ({ input }) => {
    try {
      await deps.periodAdminService.unarchivePeriod(input.reportId);
      return { success: true as const };
    } catch (error) {
      throw mapDomainError(error);
    }
  });
}

export function createArchiveRouter(deps: ArchiveRouterDeps) {
  return router({
    list: buildListProcedure(deps),
    detail: buildDetailProcedure(deps),
    archiveReport: buildArchiveReportProcedure(deps),
    unarchiveReport: buildUnarchiveReportProcedure(deps),
  });
}
