import "server-only";

import { AUTH_COOKIE_NAME } from "@weeklyreport/shared";
import { cookies } from "next/headers";

import {
  requireApiUrl,
  SERVER_FETCH_TIMEOUT_MS,
  shouldUseDevAuthFallback,
  TRPC_BATCH_EMPTY_INPUT,
} from "../transport/api-url";
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
      signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as unknown;
    return decodeAuthMeResponse(body);
  } catch {
    // Failure-closed: any network/parse error ⇒ no session ⇒ ForbiddenPage.
    return null;
  }
}
