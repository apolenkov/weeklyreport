import {
  type ArchiveReportDetail,
  type ArchiveReportSummary,
  archiveReportDetailSchema,
  archiveReportSummarySchema,
  type PaginatedResult,
  type Role,
} from "@customreport/shared";

import type { ArchiveScopeSession, ArchiveService } from "./archive.service";

export type ArchiveListContext = {
  archiveService: ArchiveService;
  role?: Role;
  session?: ArchiveScopeSession;
};

export type ArchiveDetailContext = {
  archiveService: ArchiveService;
  reportId: string;
  role?: Role;
  session?: ArchiveScopeSession;
};

export const archiveRouter = {
  async listArchiveReports(
    ctx: ArchiveListContext,
  ): Promise<PaginatedResult<ArchiveReportSummary>> {
    const result = await ctx.archiveService.listArchiveReports(
      undefined,
      ctx.role,
      ctx.session,
    );

    return {
      items: archiveReportSummarySchema.array().parse(result.items),
      nextCursor: result.nextCursor,
    };
  },
  async getArchiveReport(
    ctx: ArchiveDetailContext,
  ): Promise<ArchiveReportDetail> {
    return archiveReportDetailSchema.parse(
      await ctx.archiveService.getArchiveReport(
        ctx.reportId,
        ctx.role,
        ctx.session,
      ),
    );
  },
};
