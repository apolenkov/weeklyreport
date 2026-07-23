import { publicProcedure, router } from "../trpc.middleware.js";

export function createAuthRouter() {
  return router({
    me: publicProcedure.query(({ ctx }) => {
      // ctx.session is UserSession | null; null means unauthenticated.
      // Returning null lets the client distinguish "loaded, no session"
      // from "still loading" without throwing — preventing the 401
      // interceptor from triggering an immediate redirect on every load.
      //
      // `session.organization` is hydrated by the
      // context factory (mirrors viewerGroupAccess pattern) so the web
      // chrome can render the brand without a second round-trip.
      return ctx.session;
    }),
    // The `/print` web route gate needs the one bit `me` cannot give it —
    // whether the inbound cookie verified as a PDF-export-scoped JWT
    // (`ctx.isPdfExport`) and the bound `reportId` (`ctx.pdfReportId`). For a
    // `requestedBy` PDF token the synthetic session IS the requester's real
    // session, so the session alone cannot tell the PDF worker apart from that
    // human; only these two context flags discriminate. `publicProcedure`
    // (not pdfExport-guarded), so the worker token reaches it; returns the
    // session too so the gate reads the cookie once and branches worker /
    // human-redirect / login.
    printGate: publicProcedure.query(({ ctx }) => {
      return {
        session: ctx.session,
        isPdfExport: ctx.isPdfExport,
        pdfReportId: ctx.pdfReportId,
      };
    }),
  });
}
