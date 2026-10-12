import { type Role, ROLE_HOME_PATH } from "@customreport/shared";

import { isViewer } from "../../lib/auth/role-predicates";
import {
  ADMIN_ROUTE,
  HEAD_DASHBOARD_ROUTE,
  HEAD_REPORT_ROUTE,
  REPORTS_LATEST_ROUTE,
  REPORTS_ROUTE,
} from "./nav-links";

function isReportDetailPath(pathname: string): boolean {
  return /^\/reports\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    pathname,
  );
}

// Viewer Status (`/reports/latest`) resolves to `/reports/[id]`, so a detail
// path lights Status and History stays lit only on bare `/reports`.
// `undefined` = no viewer opinion, so the shared rules below still apply and
// head/lead stay History-active on detail paths.
function viewerActiveLink(pathname: string, href: string): boolean | undefined {
  if (href === REPORTS_LATEST_ROUTE) {
    return pathname === REPORTS_LATEST_ROUTE || isReportDetailPath(pathname);
  }
  if (href === REPORTS_ROUTE) return pathname === REPORTS_ROUTE;
  return undefined;
}

export function isActiveLink(
  pathname: string,
  href: string,
  role: Role | null,
): boolean {
  if (href === ADMIN_ROUTE) return pathname.startsWith(ADMIN_ROUTE);
  if (href === HEAD_REPORT_ROUTE) return pathname.startsWith(HEAD_REPORT_ROUTE);
  if (href === HEAD_DASHBOARD_ROUTE) return pathname === HEAD_DASHBOARD_ROUTE;
  if (isViewer(role)) {
    const viewerMatch = viewerActiveLink(pathname, href);
    if (viewerMatch !== undefined) return viewerMatch;
  }
  if (href === REPORTS_ROUTE) {
    // Exact match (not startsWith) so report subpaths hit the detail-path
    // check, not History. Independent of archive toggle / stray `?tab`.
    return pathname === REPORTS_ROUTE || isReportDetailPath(pathname);
  }
  return pathname.startsWith(href);
}

export const getLogoHref = (role: Role) => ROLE_HOME_PATH[role];
