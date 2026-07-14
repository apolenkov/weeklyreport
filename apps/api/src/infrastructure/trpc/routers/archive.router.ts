import { paginationInputSchema } from "@customreport/shared";
import { z } from "zod";

import type { AdminService } from "../../../modules/admin/admin.service.js";
import type { ArchiveService } from "../../../modules/archive/archive.service.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { anyRoleProcedure, headProcedure, router } from "../trpc.middleware.js";

export interface ArchiveRouterDeps {
  archiveService: ArchiveService;
  adminService: AdminService;
}

// archive.list / archive.detail use anyRoleProcedure
// because heads, leads, admins, and viewers all consume this surface but
// with different row visibility. The Prisma `where` filter at the service
// layer (driven by ctx.session.role) is the actual gate — viewers can
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
  });
}
