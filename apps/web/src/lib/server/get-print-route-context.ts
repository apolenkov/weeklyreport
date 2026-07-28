import "server-only";

import { type UserSession, userSessionSchema } from "@customreport/shared";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "../../server/auth/session";
import {
  decodeTrpcBatchPayload,
  requireApiUrl,
  shouldUseDevAuthFallback,
  TRPC_BATCH_EMPTY_INPUT,
} from "./api-url";

// /print is outside the proxy auth matcher — this gate handles no-session itself
// (session: null, isPdfExport: false → redirect to login). Fail-closed on errors.
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

function decodePrintGateResponse(body: unknown): PrintRouteContext {
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

export async function getPrintRouteContext(): Promise<PrintRouteContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token && !shouldUseDevAuthFallback()) return NO_CONTEXT;

  const apiUrl = requireApiUrl();
  const url = `${apiUrl}/trpc/auth.printGate?batch=1&input=${TRPC_BATCH_EMPTY_INPUT}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return NO_CONTEXT;
    const body = (await response.json()) as unknown;
    return decodePrintGateResponse(body);
  } catch {
    return NO_CONTEXT;
  }
}

// Exported for unit testing — keeps the decoder pure and observable.
export { decodePrintGateResponse };
