import { parse } from 'cookie';

import { userSessionSchema, type UserSession } from '@customreport/shared';

const AUTH_COOKIE_NAME = 'customreport_session';

export function extractSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = parse(cookieHeader);

  return cookies[AUTH_COOKIE_NAME] ?? null;
}

export function parseSessionPayload(payload: unknown): UserSession {
  return userSessionSchema.parse(payload);
}
