import type { DbRole, Role } from "@customreport/shared";
import { ROLE_HOME_PATH, sessionRoleSchema } from "@customreport/shared";

// Homed in shared so login, role-switcher, and api dev-login cannot drift.
export { ROLE_LABEL } from "@customreport/shared";

// Fallback email when no last-role hint; keyed by DbRole (pre-session lookup).
export { DEV_LOGIN_EMAIL_BY_ROLE as DEV_EMAIL_FOR_ROLE } from "@customreport/shared";

export function devLoginHref(role: DbRole, email: string): string {
  const params = new URLSearchParams({
    role,
    email,
    redirect: ROLE_HOME_PATH[role],
  });
  return `/auth/dev-login?${params.toString()}`;
}

export const FALLBACK_REDIRECT = ROLE_HOME_PATH.head;

export function defaultRedirectFor(role: unknown): string {
  return isRole(role) ? ROLE_HOME_PATH[role] : FALLBACK_REDIRECT;
}

export function isRole(value: unknown): value is Role {
  return sessionRoleSchema.safeParse(value).success;
}

export function getSessionRole(value: unknown): Role | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const role = (value as { role?: unknown }).role;
  return isRole(role) ? role : undefined;
}
