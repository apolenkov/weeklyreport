import { z } from "zod";

import type { PdfExportService } from "../../../modules/pdf-export/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { leadershipProcedure, router } from "../trpc.middleware.js";

export interface PdfExportRouterDeps {
  pdfExportService: PdfExportService;
}

export function createPdfExportRouter(deps: PdfExportRouterDeps) {
  return router({
    // Lead is the data subject, not an exporter — leadershipProcedure only.
    // PDF render is requester-scoped: worker token carries their userId so the
    // print page matches their in-app view (full vs group slice).
    request: leadershipProcedure
      .input(z.object({ reportId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await deps.pdfExportService.requestPdfExport(
            input.reportId,
            ctx.session,
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
