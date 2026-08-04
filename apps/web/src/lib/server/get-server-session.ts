import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "../../server/auth/session";
import {
  requireApiUrl,
  shouldUseDevAuthFallback,
  TRPC_BATCH_EMPTY_INPUT,
} from "./api-url";
import { decodeAuthMeResponse } from "./decode-auth-me";

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token && !shouldUseDevAuthFallback()) return null;

  const apiUrl = requireApiUrl();
  const url = `${apiUrl}/trpc/auth.me?batch=1&input=${TRPC_BATCH_EMPTY_INPUT}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      ...(token ? { headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` } } : {}),
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
