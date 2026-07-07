import { type PdfExportJob, pdfExportJobSchema } from "@customreport/shared";

import { PdfExportService } from "./pdf-export.service";

export interface PdfExportRouterRequestContext {
  pdfExportService: PdfExportService;
  reportId: string;
  /**
   * Session userId of the head requesting the export.
   * Optional for parity with the bare service call; tRPC callers should
   * always supply `ctx.session.userId`.
   */
  requestedBy?: string;
}

export interface PdfExportRouterStatusContext {
  pdfExportService: PdfExportService;
  jobId: string;
  requestedBy?: string;
}

export const pdfExportRouter = {
  async requestPdfExport(
    ctx: PdfExportRouterRequestContext,
  ): Promise<PdfExportJob> {
    return pdfExportJobSchema.parse(
      await ctx.pdfExportService.requestPdfExport(
        ctx.reportId,
        ctx.requestedBy,
      ),
    );
  },
  async getPdfExportStatus(
    ctx: PdfExportRouterStatusContext,
  ): Promise<PdfExportJob> {
    return pdfExportJobSchema.parse(
      await ctx.pdfExportService.getPdfExportStatus(ctx.jobId, ctx.requestedBy),
    );
  },
};
