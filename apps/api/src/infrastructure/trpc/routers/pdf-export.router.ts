import { z } from "zod";

import type { PdfExportService } from "../../../modules/pdf-export/index.js";
import { withDomainErrorMapping } from "../trpc.error-mapper.js";
import {
  captureMutationAuditInputMiddleware,
  leadershipProcedure,
  router,
} from "../trpc.middleware.js";

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
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.pdfExportService.requestPdfExport(
            input.reportId,
            ctx.session,
            ctx.session.role,
          ),
        ),
      ),

    status: leadershipProcedure
      .input(z.object({ jobId: z.uuid() }))
      .query(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.pdfExportService.getPdfExportStatus(
            input.jobId,
            ctx.session.userId,
          ),
        ),
      ),

    render: leadershipProcedure
      .input(z.object({ jobId: z.uuid(), reportId: z.uuid() }))
      .query(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.pdfExportService.getPdfExportRender(
            input.jobId,
            ctx.session.userId,
            input.reportId,
          ),
        ),
      ),
  });
}
