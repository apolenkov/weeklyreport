import { publicProcedure, router } from "../trpc.middleware.js";

/**
 * Create Auth Router.
 */
export function createAuthRouter() {
  return router({
    me: publicProcedure.query(({ ctx }) => {
      // Null (not throw) so "loaded, no session" ≠ "still loading" and the
      // 401 interceptor does not redirect on every load.
      return ctx.session;
    }),
    // requestedBy PDF session matches the human's; only isPdfExport +
    // pdfReportId discriminate. publicProcedure so the worker token reaches it.
    printGate: publicProcedure.query(({ ctx }) => {
      return {
        session: ctx.session,
        isPdfExport: ctx.isPdfExport,
        pdfReportId: ctx.pdfReportId,
      };
    }),
  });
}
