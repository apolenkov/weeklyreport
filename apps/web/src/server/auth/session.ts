import { type UserSession, userSessionSchema } from "@customreport/shared";
import { parse } from "cookie";

const AUTH_COOKIE_NAME = "customreport_session";

export function extractSessionToken(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = parse(cookieHeader);

  return cookies[AUTH_COOKIE_NAME] ?? null;
}

export function parseSessionPayload(payload: unknown): UserSession {
  return userSessionSchema.parse(payload);
}
