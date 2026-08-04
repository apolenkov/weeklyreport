import type { Role } from "@customreport/shared";

export const ADMIN_ROUTE_ROLES: readonly Role[] = ["admin"];
export const HEAD_ROUTE_ROLES: readonly Role[] = ["head", "admin"];
export const LEAD_ROUTE_ROLES: readonly Role[] = ["lead", "head", "admin"];
export const REPORTS_ROUTE_ROLES: readonly Role[] = [
  "lead",
  "head",
  "admin",
  "viewer",
];
export const LEAD_PREVIEW_ROUTE_ROLES: readonly Role[] = ["lead"];
export const VIEWER_STATUS_ROUTE_ROLES: readonly Role[] = ["viewer"];

const ROUTE_POLICIES: readonly Readonly<{
  path: string;
  match: "exact" | "prefix";
  roles: readonly Role[];
}>[] = [
  {
    path: "/lead/report/[reportId]/preview",
    match: "exact",
    roles: LEAD_PREVIEW_ROUTE_ROLES,
  },
  {
    path: "/reports/latest",
    match: "exact",
    roles: VIEWER_STATUS_ROUTE_ROLES,
  },
  { path: "/admin", match: "prefix", roles: ADMIN_ROUTE_ROLES },
  { path: "/head", match: "prefix", roles: HEAD_ROUTE_ROLES },
  { path: "/lead", match: "prefix", roles: LEAD_ROUTE_ROLES },
  { path: "/reports", match: "prefix", roles: REPORTS_ROUTE_ROLES },
];

export const rolesForGuardedRoute = (route: string): readonly Role[] | null =>
  ROUTE_POLICIES.find(
    ({ path, match }) =>
      route === path || (match === "prefix" && route.startsWith(`${path}/`)),
  )?.roles ?? null;
