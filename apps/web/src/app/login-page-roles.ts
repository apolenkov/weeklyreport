/**
 * Role-aware landing-redirect config for the login page: the per-role default
 * routes, the seeded dev-login email/label tables, and the pure helpers that
 * derive a redirect target or dev-login URL from them.
 */
import { ROLE_HOME_PATH } from "@customreport/shared";

export type Role = "lead" | "head" | "admin" | "viewer";

// The per-role display label and landing route are homed once in
// `@customreport/shared` (web-shared-idioms) so the login page, dev
// role-switcher, api dev-login, and `roleHomePath` cannot drift. Re-exported
// here for the login-page consumers that already import from this module.
export { ROLE_LABEL } from "@customreport/shared";

/**
 * Seeded dev-mode emails per role. The role grid
 * on the landing card uses these as the fallback email when no
 * persisted hint exists for that role. Must stay in sync with the
 * `emailByRole` table in `apps/api/src/modules/auth/auth.routes.ts`
 * and the seeded users in `prisma/seed-simple.ts`.
 */
export const DEV_EMAIL_FOR_ROLE: Record<Role, string> = {
  lead: "lead1@customreport.local",
  head: "head@customreport.local",
  admin: "admin@customreport.local",
  viewer: "viewer@customreport.local",
};

/**
 * Build the `/auth/dev-login` URL for a given role + email, with the
 * post-login redirect honouring the role's default landing route.
 */
export function devLoginHref(role: Role, email: string): string {
  const params = new URLSearchParams({
    role,
    email,
    redirect: ROLE_HOME_PATH[role],
  });
  return `/auth/dev-login?${params.toString()}`;
}

export const FALLBACK_REDIRECT = "/head/dashboard";

export function defaultRedirectFor(role: Role | null | undefined): string {
  if (!role) return FALLBACK_REDIRECT;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- role may be a persisted/retired value absent from ROLE_HOME_PATH at runtime
  return ROLE_HOME_PATH[role] ?? FALLBACK_REDIRECT;
}

export function isRole(value: unknown): value is Role {
  return (
    value === "lead" ||
    value === "head" ||
    value === "admin" ||
    value === "viewer"
  );
}

export function getSessionRole(value: unknown): Role | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const role = (value as { role?: unknown }).role;
  return isRole(role) ? role : undefined;
}
