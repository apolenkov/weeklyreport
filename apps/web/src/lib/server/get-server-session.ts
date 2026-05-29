import "server-only";

import type { UserSession } from "@customreport/shared";
import { cookies } from "next/headers";

/**
 * AUTH-07 (Phase 29-03): server-only helper that reads the session cookie
 * via Next.js `cookies()` and resolves to a verified UserSession by calling
 * the API's `auth.me` tRPC procedure.
 *
 * Threat-model notes:
 *  - T1: layout-level UX gate only — the actual security boundary is the
 *    api's role middleware (Phase 27 + Phase 29-01). This helper exists so
 *    the user does not see protected layout chrome before the tRPC error
 *    surfaces; it is NOT a substitute for server-side authorisation.
 *  - T2: tRPC v11 superjson + httpBatchLink batches even single GET queries
 *    as `?batch=1&input={"0":{"json":<payload>}}`. We issue a single
 *    request to `auth.me` with no payload — input map carries `0: {}` to
 *    satisfy the batch shape.
 *  - T3: stale session — the JWT carries the role at sign-time; if the user
 *    was downgraded in Keycloak after the cookie was issued, this helper
 *    returns the (still-valid) session until the cookie expires (1 h).
 *    Documented limitation, no real-time revocation in v6.0.
 *
 * `cache: 'no-store'` is mandatory — every request must consult the API
 * fresh, otherwise role downgrades would be invisible until the Next.js
 * data cache invalidates.
 */
const COOKIE_NAME = "customreport_session";

function resolveApiUrl(): string {
  // In production, NEXT_PUBLIC_API_URL points at the API hostname inside
  // the docker network or behind the corporate proxy. In the local regression
  // stack, the Nest API listens on :3002.
  return (
    process.env["API_URL"] ??
    process.env["NEXT_PUBLIC_API_URL"] ??
    "http://localhost:3002"
  );
}

type TrpcBatchEntry = {
  readonly result?: { readonly data?: unknown };
  readonly error?: { readonly message?: string };
};

/**
 * Decode a tRPC v11 superjson-batched query response.
 *
 * The shape is `[{ result: { data: { json: <payload>, meta?: ... } } }]`
 * for the superjson transformer. We tolerate the un-transformed shape too
 * (`result.data === <payload>`) for resilience against config drift.
 */
function decodeAuthMeResponse(body: unknown): UserSession | null {
  if (!Array.isArray(body) || body.length === 0) return null;
  const entry = body[0] as TrpcBatchEntry | undefined;
  if (!entry || entry.error) return null;
  const data = entry.result?.data;
  if (data === null || data === undefined) return null;
  if (typeof data === "object" && "json" in (data as Record<string, unknown>)) {
    const inner = (data as { json: unknown }).json;
    return inner === null ? null : (inner as UserSession);
  }
  return data as UserSession;
}

export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const shouldUseDevFallback =
    process.env["NODE_ENV"] !== "production" &&
    (process.env["AUTH_DEV_MODE"] === "true" ||
      process.env["AUTH_DEV_MODE_ALLOW_TEST"] === "true");
  if (!token && !shouldUseDevFallback) return null;

  const apiUrl = resolveApiUrl();
  // tRPC v11 batched GET — `input` is a JSON map keyed by request index.
  // For a procedure with no input, `{"0":{}}` is the canonical empty form
  // (superjson transformer accepts undefined input).
  const inputParam = encodeURIComponent('{"0":{}}');
  const url = `${apiUrl}/trpc/auth.me?batch=1&input=${inputParam}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { cookie: `${COOKIE_NAME}=${token}` } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as unknown;
    return decodeAuthMeResponse(body);
  } catch {
    // Failure-closed: any network/parse error ⇒ no session ⇒ ForbiddenPage.
    return null;
  }
}

// Exported for unit testing — keeps the decoder pure and observable.
export { decodeAuthMeResponse };
