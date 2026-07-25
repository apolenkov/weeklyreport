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

// Viewer Status (`/reports/latest`) resolves to `/reports/[id]`, so a detail
// path must light Status, not History. History stays lit only on bare
// `/reports`. `undefined` = no viewer-specific opinion, so the shared rules
// below still apply (head/lead History-active on detail paths is untouched).
function viewerActiveLink(pathname: string, href: string): boolean | undefined {
  if (href === REPORTS_LATEST_ROUTE) {
    return pathname === REPORTS_LATEST_ROUTE || isReportDetailPath(pathname);
  }
  if (href === "/reports") return pathname === "/reports";
  return undefined;
}

/**
 * Is Active Link.
 * @param pathname - The pathname argument.
 * @param href - The href argument.
 * @param role - The role argument.
 */
export function isActiveLink(
  pathname: string,
  href: string,
  role: Role | null,
): boolean {
  if (href === "/admin") return pathname.startsWith("/admin");
  if (href === HEAD_REPORT_ROUTE) return pathname.startsWith(HEAD_REPORT_ROUTE);
  if (href === HEAD_DASHBOARD_ROUTE) return pathname === HEAD_DASHBOARD_ROUTE;
  if (isViewer(role)) {
    const viewerMatch = viewerActiveLink(pathname, href);
    if (viewerMatch !== undefined) return viewerMatch;
  }
  if (href === "/reports") {
    // Exact match (not startsWith) so report subpaths hit the detail-path
    // check, not History. Independent of archive toggle / stray `?tab`.
    return pathname === "/reports" || isReportDetailPath(pathname);
  }
  return pathname.startsWith(href);
}

/**
 * Get Logo Href.
 * @param role - The role argument.
 */
export const getLogoHref = (role: Role) => ROLE_HOME_PATH[role];
