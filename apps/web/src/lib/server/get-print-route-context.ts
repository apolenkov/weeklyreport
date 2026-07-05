import "server-only";

import type { UserSession } from "@customreport/shared";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "../../server/auth/session";
import {
  decodeTrpcBatchPayload,
  requireApiUrl,
  shouldUseDevAuthFallback,
} from "./api-url";

/**
 * fix-report-surface-integrity W2 (task 3.3): server-only helper for the
 * `/print/[reportId]` route gate. Reads the session cookie via Next.js
 * `cookies()` and resolves the API's `auth.printGate` tRPC procedure, which
 * surfaces the PDF-worker-vs-human discriminator (`isPdfExport` +
 * `pdfReportId`) alongside the session.
 *
 * The `/print` route is NOT under the proxy.ts auth matcher, so the gate must
 * handle the no-session case itself — this helper resolves to a context with
 * `session: null` and `isPdfExport: false` for an unauthenticated request, and
 * the gate redirects it to login.
 *
 * Mirrors `get-server-session.ts`: single batched GET to the API, superjson
 * decode, fail-closed on any network/parse error.
 */
const COOKIE_NAME = AUTH_COOKIE_NAME;

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
  return {
    session: (p.session as UserSession | null) ?? null,
    isPdfExport: p.isPdfExport === true,
    pdfReportId: typeof p.pdfReportId === "string" ? p.pdfReportId : null,
  };
}

export async function getPrintRouteContext(): Promise<PrintRouteContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token && !shouldUseDevAuthFallback()) return NO_CONTEXT;

  const apiUrl = requireApiUrl();
  const inputParam = encodeURIComponent('{"0":{}}');
  const url = `${apiUrl}/trpc/auth.printGate?batch=1&input=${inputParam}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { cookie: `${COOKIE_NAME}=${token}` } : undefined,
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
