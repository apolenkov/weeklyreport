import {
  archiveReportDetailSchema,
  archiveReportSummarySchema,
  type ArchiveReportDetail,
  type ArchiveReportSummary,
} from '@customreport/shared';

import { type ArchiveService } from './archive.service';

export type ArchiveListContext = {
  archiveService: ArchiveService;
};

export type ArchiveDetailContext = {
  archiveService: ArchiveService;
  reportId: string;
};

export const archiveRouter = {
  async listArchiveReports(ctx: ArchiveListContext): Promise<ArchiveReportSummary[]> {
    return archiveReportSummarySchema.array().parse(
      await ctx.archiveService.listArchiveReports(),
    );
  },
  async getArchiveReport(ctx: ArchiveDetailContext): Promise<ArchiveReportDetail> {
    return archiveReportDetailSchema.parse(
      await ctx.archiveService.getArchiveReport(ctx.reportId),
    );
  },
};
