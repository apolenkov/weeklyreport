import "server-only";

import { AUTH_COOKIE_NAME } from "@customreport/shared";
import { cookies } from "next/headers";

import {
  requireApiUrl,
  shouldUseDevAuthFallback,
  TRPC_BATCH_EMPTY_INPUT,
} from "../../../../shared/server/transport/api-url";
import {
  decodePrintGateResponse,
  type PrintRouteContext,
} from "./decode-print-gate";

export type { PrintRouteContext };

// /print is outside the proxy auth matcher — this gate handles no-session itself
// (session: null, isPdfExport: false → redirect to login). Fail-closed on errors.
const NO_CONTEXT: PrintRouteContext = {
  session: null,
  isPdfExport: false,
  pdfReportId: null,
  pdfJobId: null,
};

export async function getPrintRouteContext(): Promise<PrintRouteContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token && !shouldUseDevAuthFallback()) return NO_CONTEXT;

  const apiUrl = requireApiUrl();
  const url = `${apiUrl}/trpc/auth.printGate?batch=1&input=${TRPC_BATCH_EMPTY_INPUT}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      ...(token ? { headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` } } : {}),
      cache: "no-store",
    });
    if (!response.ok) return NO_CONTEXT;
    const body = (await response.json()) as unknown;
    return decodePrintGateResponse(body);
  } catch {
    return NO_CONTEXT;
  }
}
