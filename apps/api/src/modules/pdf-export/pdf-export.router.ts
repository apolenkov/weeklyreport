import {
  type PdfExportJob,
  pdfExportJobSchema,
  type UserSession,
} from "@customreport/shared";

import { PdfExportService } from "./pdf-export.service";

export interface PdfExportRouterRequestContext {
  pdfExportService: PdfExportService;
  reportId: string;
  session: UserSession;
}

export interface PdfExportRouterStatusContext {
  pdfExportService: PdfExportService;
  jobId: string;
  requestedBy: string;
}

export const pdfExportRouter = {
  async requestPdfExport(
    ctx: PdfExportRouterRequestContext,
  ): Promise<PdfExportJob> {
    return pdfExportJobSchema.parse(
      await ctx.pdfExportService.requestPdfExport(ctx.reportId, ctx.session),
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
