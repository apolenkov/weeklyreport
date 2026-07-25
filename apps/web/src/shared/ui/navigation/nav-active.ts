import { type Role, ROLE_HOME_PATH } from "@customreport/shared";

import { isViewer } from "../../../lib/role-predicates";
import {
  HEAD_DASHBOARD_ROUTE,
  HEAD_REPORT_ROUTE,
  REPORTS_LATEST_ROUTE,
} from "./nav-links";

function isReportDetailPath(pathname: string): boolean {
  return /^\/reports\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    pathname,
  );
}

export function isActiveLink(
  pathname: string,
  href: string,
  role: Role | null,
): boolean {
  if (href === "/admin") return pathname.startsWith("/admin");
  if (href === HEAD_REPORT_ROUTE) return pathname.startsWith(HEAD_REPORT_ROUTE);
  if (href === HEAD_DASHBOARD_ROUTE) return pathname === HEAD_DASHBOARD_ROUTE;
  // Viewer Status (`/reports/latest`) resolves to `/reports/[id]`, so a detail
  // path must light Status, not History. History stays lit only on bare
  // `/reports`. Scoped so head/lead History-active on detail paths is untouched.
  if (isViewer(role)) {
    if (href === REPORTS_LATEST_ROUTE) {
      return pathname === REPORTS_LATEST_ROUTE || isReportDetailPath(pathname);
    }
    if (href === "/reports") {
      return pathname === "/reports";
    }
  }
  if (href === "/reports") {
    // Exact match (not startsWith) so report subpaths hit the detail-path
    // check, not History. Independent of archive toggle / stray `?tab`.
    return pathname === "/reports" || isReportDetailPath(pathname);
  }
  return pathname.startsWith(href);
}

export const getLogoHref = (role: Role) => ROLE_HOME_PATH[role];
