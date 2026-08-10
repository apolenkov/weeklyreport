import "server-only";

import { type UserSession, userSessionSchema } from "@customreport/shared";

import { decodeTrpcBatchPayload } from "../../../../shared/server/transport/api-url";

// Print-route context carries session, worker-token state, and report id.
export interface PrintRouteContext {
  readonly session: UserSession | null;
  readonly isPdfExport: boolean;
  readonly pdfReportId: string | null;
}

const NO_CONTEXT: PrintRouteContext = {
  session: null,
  isPdfExport: false,
  pdfReportId: null,
};

// Malformed print-gate payloads resolve to NO_CONTEXT so the route fails closed.
export function decodePrintGateResponse(body: unknown): PrintRouteContext {
  const payload = decodeTrpcBatchPayload(body);
  if (payload === null || typeof payload !== "object") return NO_CONTEXT;
  const p = payload as Record<string, unknown>;
  const session = userSessionSchema.safeParse(p.session);
  return {
    session: session.success ? session.data : null,
    isPdfExport: p.isPdfExport === true,
    pdfReportId: typeof p.pdfReportId === "string" ? p.pdfReportId : null,
  };
}
