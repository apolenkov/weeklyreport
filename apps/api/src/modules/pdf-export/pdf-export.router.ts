import { pdfExportJobSchema, type PdfExportJob } from '@customreport/shared';

import { type PdfExportService } from './pdf-export.service';

export type PdfExportRouterRequestContext = {
  pdfExportService: PdfExportService;
  reportId: string;
  /**
   * Phase 23-01: session userId of the head requesting the export.
   * Optional for parity with the bare service call; tRPC callers should
   * always supply `ctx.session.userId`.
   */
  requestedBy?: string;
};

export type PdfExportRouterStatusContext = {
  pdfExportService: PdfExportService;
  jobId: string;
  requestedBy?: string;
};

export const pdfExportRouter = {
  async requestPdfExport(ctx: PdfExportRouterRequestContext): Promise<PdfExportJob> {
    return pdfExportJobSchema.parse(
      await ctx.pdfExportService.requestPdfExport(ctx.reportId, ctx.requestedBy),
    );
  },
  async getPdfExportStatus(ctx: PdfExportRouterStatusContext): Promise<PdfExportJob> {
    return pdfExportJobSchema.parse(
      await ctx.pdfExportService.getPdfExportStatus(ctx.jobId, ctx.requestedBy),
    );
  },
};
