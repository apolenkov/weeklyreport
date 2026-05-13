import type { Role } from "@customreport/shared";

/**
 * AUTH-06 (Phase 29-06): pure role-visibility helper for nav link filtering.
 *
 * MIRRORS the REQUIRED-roles arrays in the four `(app)/{admin,head,lead,reports}/layout.tsx`
 * server-side gates from Phase 29-03. The two MUST stay in sync — if a layout
 * widens or narrows its role set, this map widens or narrows too. The
 * server-side layout is the trust boundary; this helper is a pure UX hide.
 *
 * Routes not in the map (e.g. '/auth/login') are visible to all authenticated
 * roles by default — they have their own access semantics handled by the
 * proxy.ts cookie gate.
 */
export type RoutePrefix = "/admin" | "/head" | "/lead" | "/reports";

// UFB-057 / Phase 57: 'director' gets the same read-access shape as viewer
// for `/reports` (published archive) and joins head+admin for `/head` —
// directors land on /head/dashboard by default. The /head/report
// submission surface is gated separately by a nested layout (see
// apps/web/src/app/(app)/head/report/layout.tsx) so director cannot author
// a weekly report. `/lead` and `/admin` remain closed to director.
export const ROUTE_ROLE_MAP: Readonly<
  Record<RoutePrefix, ReadonlyArray<Role>>
> = {
  "/admin": ["admin", "head"],
  "/head": ["head", "admin", "director"],
  "/lead": ["lead", "head", "admin"],
  "/reports": ["lead", "head", "admin", "viewer", "director"],
};

const ROUTE_PREFIXES = Object.keys(ROUTE_ROLE_MAP) as RoutePrefix[];

/**
 * Returns true when a link to `route` should appear in the nav for `role`.
 *
 * Matching is prefix-based: `/lead/report` matches the `/lead` prefix and
 * inherits its allowed-role set. Unmapped routes default to visible.
 */
export function isRouteVisible(route: string, role: Role): boolean {
  for (const prefix of ROUTE_PREFIXES) {
    if (route === prefix || route.startsWith(prefix + "/")) {
      return ROUTE_ROLE_MAP[prefix].includes(role);
    }
  }
  return true;
}
