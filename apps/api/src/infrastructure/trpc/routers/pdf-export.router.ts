import { z } from "zod";

import type { PdfExportService } from "../../../modules/pdf-export/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { leadershipProcedure, router } from "../trpc.middleware.js";

export interface PdfExportRouterDeps {
  pdfExportService: PdfExportService;
}

export function createPdfExportRouter(deps: PdfExportRouterDeps) {
  return router({
    // Export-PDF is gated by `leadershipProcedure` (head + admin + viewer).
    // Lead is EXCLUDED and gets FORBIDDEN — a lead is the data subject of the
    // report, not an exporter; the lead UI surfaces a ComingSoon control
    // instead of firing the export. request + status share the same gate so a
    // permitted caller can both fire the job and poll its status. The PDF
    // render is REQUESTER-SCOPED: the worker token carries the requester's
    // userId and the print page renders under their rebuilt session, so each
    // role's PDF matches their in-app view (head/admin → full report, viewer →
    // their slice). Viewer export is safe because the empty-PDF path gives the
    // viewer a non-empty, scoped render.
    request: leadershipProcedure
      .input(z.object({ reportId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Thread session userId so the pdf_export_jobs row
          // attributes the request to the requester, not 'system'.
          return await deps.pdfExportService.requestPdfExport(
            input.reportId,
            ctx.session,
            undefined,
            // Role label for
            // customreport_pdf_export_requests_total{role}.
            ctx.session.role,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    status: leadershipProcedure
      .input(z.object({ jobId: z.uuid() }))
      .query(async ({ input, ctx }) => {
        try {
          return await deps.pdfExportService.getPdfExportStatus(
            input.jobId,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}
