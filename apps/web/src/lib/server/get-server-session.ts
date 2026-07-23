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
 * Server-only helper that reads the session cookie via Next.js `cookies()`
 * and resolves to a verified UserSession by calling the API's `auth.me`
 * tRPC procedure.
 *
 * Threat-model notes:
 *  - T1: layout-level UX gate only — the actual security boundary is the
 *    api's role middleware. This helper exists so
 *    the user does not see protected layout chrome before the tRPC error
 *    surfaces; it is NOT a substitute for server-side authorisation.
 *  - T2: tRPC v11 superjson + httpBatchLink batches even single GET queries
 *    as `?batch=1&input={"0":{"json":<payload>}}`. We issue a single
 *    request to `auth.me` with no payload — input map carries `0: {}` to
 *    satisfy the batch shape.
 *  - T3: stale session — the JWT carries the role at sign-time; if the user
 *    was downgraded in Keycloak after the cookie was issued, this helper
 *    returns the (still-valid) session until the cookie expires (1 h).
 *    Documented limitation: no real-time role revocation.
 *
 * `cache: 'no-store'` is mandatory — every request must consult the API
 * fresh, otherwise role downgrades would be invisible until the Next.js
 * data cache invalidates.
 */
const COOKIE_NAME = AUTH_COOKIE_NAME;

function decodeAuthMeResponse(body: unknown): UserSession | null {
  const payload = decodeTrpcBatchPayload(body);
  return payload === null ? null : (payload as UserSession);
}

export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token && !shouldUseDevAuthFallback()) return null;

  const apiUrl = requireApiUrl();
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
