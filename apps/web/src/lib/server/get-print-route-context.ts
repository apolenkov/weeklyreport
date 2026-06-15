import "server-only";

import type { UserSession } from "@customreport/shared";
import { cookies } from "next/headers";

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
const COOKIE_NAME = "customreport_session";

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

function resolveApiUrl(): string {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3002"
  );
}

interface TrpcBatchEntry {
  readonly result?: { readonly data?: unknown };
  readonly error?: { readonly message?: string };
}

/**
 * Decode a tRPC v11 superjson-batched query response into the print-gate
 * context. Tolerates both the superjson-wrapped shape
 * (`result.data.json === <payload>`) and the un-transformed shape
 * (`result.data === <payload>`) for resilience against config drift.
 */
function decodePrintGateResponse(body: unknown): PrintRouteContext {
  if (!Array.isArray(body) || body.length === 0) return NO_CONTEXT;
  const entry = body[0] as TrpcBatchEntry | undefined;
  if (!entry || entry.error) return NO_CONTEXT;
  const data = entry.result?.data;
  if (data === null || data === undefined) return NO_CONTEXT;
  const payload =
    typeof data === "object" && "json" in (data as Record<string, unknown>)
      ? (data as { json: unknown }).json
      : data;
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
  const shouldUseDevFallback =
    process.env.NODE_ENV !== "production" &&
    (process.env.AUTH_DEV_MODE === "true" ||
      process.env.AUTH_DEV_MODE_ALLOW_TEST === "true");
  if (!token && !shouldUseDevFallback) return NO_CONTEXT;

  const apiUrl = resolveApiUrl();
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
