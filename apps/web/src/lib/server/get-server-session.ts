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

// Layout UX gate only — API role middleware is the security boundary.
// no-store is mandatory so role downgrades are not hidden by the data cache.
function decodeAuthMeResponse(body: unknown): UserSession | null {
  const payload = decodeTrpcBatchPayload(body);
  const result = userSessionSchema.safeParse(payload);
  return result.success ? result.data : null;
}

export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token && !shouldUseDevAuthFallback()) return null;

  const apiUrl = requireApiUrl();
  const url = `${apiUrl}/trpc/auth.me?batch=1&input=${TRPC_BATCH_EMPTY_INPUT}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : undefined,
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
