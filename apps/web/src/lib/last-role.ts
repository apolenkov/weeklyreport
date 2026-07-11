/**
 * «Last role memory» on the landing page.
 *
 * Stores the most recently authenticated user's role + email + name in
 * `localStorage` so that on the next visit to the AUTH_STUB landing
 * page we can offer «You were here as {Name} · {Role} — use this role
 * or change?» as a 1-click resume affordance.
 *
 * Why localStorage and not a cookie:
 *   - Client-only — no SSR / proxy / cookie-parsing surface area
 *   - Lives across browser sessions on the same device
 *   - Easy to clear (devtools or per-app reset)
 *   - Never sent to the server, so it can't be used for auth decisions
 *
 * The stored value is purely a UI hint. Authentication still goes
 * through the regular `/auth/dev-login` (stub) or SAML (real) routes.
 *
 * SSR safety: every read/write checks `typeof window !== 'undefined'`
 * and wraps JSON.parse in try/catch so a corrupted/legacy value can
 * never crash the landing render.
 */

import type { Role } from "@customreport/shared";

export interface LastRoleRecord {
  readonly role: Role;
  readonly email: string;
  readonly name: string;
}

export const LAST_ROLE_STORAGE_KEY = "customreport:lastRole";

const VALID_ROLES: ReadonlySet<Role> = new Set<Role>([
  "lead",
  "head",
  "admin",
  "viewer",
]);

function isLastRoleRecord(value: unknown): value is LastRoleRecord {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.role === "string" &&
    VALID_ROLES.has(v.role as Role) &&
    typeof v.email === "string" &&
    v.email.length > 0 &&
    typeof v.name === "string"
  );
}

/**
 * Read the persisted last-role hint. Returns null when storage is
 * unavailable (SSR, private mode), empty, or malformed.
 */
export function readLastRole(): LastRoleRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ROLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isLastRoleRecord(parsed)) return null;
    return parsed;
  } catch {
    // Storage quota / disabled / parse error — degrade silently.
    return null;
  }
}

/**
 * Persist the current session's role + email + name. Idempotent — safe
 * to call on every render where the session is known. Storage failure
 * is silent (private mode, quota exceeded).
 */
export function writeLastRole(record: LastRoleRecord): void {
  if (typeof window === "undefined") return;
  if (!isLastRoleRecord(record)) return;
  try {
    window.localStorage.setItem(LAST_ROLE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* noop */
  }
}

/**
 * Clear the hint. Intended for explicit «Sign out forever» flows; the
 * regular logout path leaves the hint in place on purpose so the next
 * sign-in is one click.
 */
export function clearLastRole(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_ROLE_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
