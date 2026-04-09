import { pdfExportJobSchema, type PdfExportJob } from '@customreport/shared';

import { type PdfExportService } from './pdf-export.service';

export type PdfExportRouterRequestContext = {
  pdfExportService: PdfExportService;
  reportId: string;
};

export type PdfExportRouterStatusContext = {
  pdfExportService: PdfExportService;
  jobId: string;
};

export const pdfExportRouter = {
  async requestPdfExport(ctx: PdfExportRouterRequestContext): Promise<PdfExportJob> {
    return pdfExportJobSchema.parse(
      await ctx.pdfExportService.requestPdfExport(ctx.reportId),
    );
  },
  async getPdfExportStatus(ctx: PdfExportRouterStatusContext): Promise<PdfExportJob> {
    return pdfExportJobSchema.parse(
      await ctx.pdfExportService.getPdfExportStatus(ctx.jobId),
    );
  },
};
