import {
  userSessionSchema,
  type Role,
  type UserSession,
} from '@customreport/shared';

import { extractSessionToken, parseSessionPayload } from '../server/auth/session';

const DEV_SESSION_STORAGE_KEY = 'customreport:dev-session';

export const defaultLeadSession: UserSession = {
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'lead1@customreport.local',
  name: 'Lead 1',
  role: 'lead',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: '11111111-1111-4111-8111-111111111111',
};

export const defaultHeadSession: UserSession = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: null,
};

export const defaultViewerSession: UserSession = {
  userId: '00000000-0000-4000-8000-000000000099',
  email: 'viewer@customreport.local',
  name: 'Stakeholder Viewer',
  role: 'viewer',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: null,
};

function decodeJwtPayload(token: string): unknown {
  const segments = token.split('.');

  if (segments.length < 2 || !segments[1]) {
    return null;
  }

  const normalizedPayload = segments[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(segments[1].length / 4) * 4, '=');

  return JSON.parse(window.atob(normalizedPayload));
}

function readCookieSession(): UserSession | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const token = extractSessionToken(document.cookie);

  if (!token) {
    return null;
  }

  try {
    return parseSessionPayload(decodeJwtPayload(token));
  } catch {
    return null;
  }
}

function readStoredDevSession(): UserSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawSession = window.localStorage.getItem(DEV_SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return userSessionSchema.parse(JSON.parse(rawSession));
  } catch {
    return null;
  }
}

export function createDemoSession(role: Role): UserSession {
  if (role === 'head') {
    return defaultHeadSession;
  }

  if (role === 'viewer') {
    return defaultViewerSession;
  }

  return defaultLeadSession;
}

export function readBrowserSession(fallbackSession: UserSession = defaultLeadSession): UserSession {
  return readCookieSession() ?? readStoredDevSession() ?? fallbackSession;
}

export function persistBrowserSession(session: UserSession): UserSession {
  const parsedSession = userSessionSchema.parse(session);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      DEV_SESSION_STORAGE_KEY,
      JSON.stringify(parsedSession),
    );
  }

  return parsedSession;
}
