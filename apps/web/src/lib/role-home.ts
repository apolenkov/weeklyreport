import type { Role } from "@customreport/shared";

/**
 * UFB-044 / UFB-034: canonical per-role home page mapping.
 *
 * Single source of truth for "where does role X land after login / when
 * the brand mark is clicked / when redirected from `/`". Centralised so
 * the dev-login redirect, the brand link in `nav-bar.tsx`, and any future
 * post-auth landing logic share identical behaviour.
 *
 * Mapping rationale:
 *
 *   - admin    → `/admin`                  admin panel is admin-only post UFB-038
 *   - head     → `/head/dashboard`         submission dashboard is the head's main surface
 *   - lead     → `/lead/report`            active section editor for the open period
 *   - viewer   → `/reports?tab=published`  archive history, no edit affordances
 *
 * Anonymous (no role) callers should fall back to `/` and let the proxy /
 * landing redirect logic decide.
 */
export function roleHomePath(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "head":
      return "/head/dashboard";
    case "lead":
      return "/lead/report";
    case "viewer":
      return "/reports?tab=published";
  }
}
