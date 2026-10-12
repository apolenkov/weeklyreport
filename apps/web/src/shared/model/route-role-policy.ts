import type { Role } from "@weeklyreport/shared";

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
