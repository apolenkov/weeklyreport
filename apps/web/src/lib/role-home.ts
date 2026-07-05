import { type Role, ROLE_HOME_PATH } from "@customreport/shared";

/**
 * Canonical per-role home page: where role X lands after login, when the brand
 * mark is clicked, or when redirected from `/`. A thin re-export of the shared
 * `ROLE_HOME_PATH` map (web-shared-idioms) so this, the web login default, and
 * the api dev-login fallback cannot diverge. Anonymous (no role) callers fall
 * back to `/` at the call site and let the landing redirect decide.
 */
export function roleHomePath(role: Role): string {
  return ROLE_HOME_PATH[role];
}
