/**
 * Role-aware landing-redirect config for the login page (UX-16, Phase 35-08).
 *
 * Extracted from login-page.client.tsx: the per-role default routes, the
 * seeded dev-login email/label tables, and the pure helpers that derive a
 * redirect target or dev-login URL from them.
 */
export type Role = "lead" | "head" | "admin" | "viewer";

export const DEFAULT_FOR_ROLE: Record<Role, string> = {
  lead: "/lead/report",
  head: "/head/dashboard",
  admin: "/admin",
  viewer: "/reports/latest",
};

/**
 * UFB-071 (2026-05-11): seeded dev-mode emails per role. The role grid
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

export const ROLE_LABEL: Record<Role, string> = {
  lead: "Lead",
  head: "Head",
  admin: "Admin",
  viewer: "Viewer",
};

/**
 * Build the `/auth/dev-login` URL for a given role + email, with the
 * post-login redirect honouring the role's default landing route.
 */
export function devLoginHref(role: Role, email: string): string {
  const params = new URLSearchParams({
    role,
    email,
    redirect: DEFAULT_FOR_ROLE[role],
  });
  return `/auth/dev-login?${params.toString()}`;
}

export const FALLBACK_REDIRECT = "/head/dashboard";

export function defaultRedirectFor(role: Role | null | undefined): string {
  if (!role) return FALLBACK_REDIRECT;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- role may be a persisted/retired value absent from DEFAULT_FOR_ROLE at runtime
  return DEFAULT_FOR_ROLE[role] ?? FALLBACK_REDIRECT;
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
