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
  // viewer-live-status: the viewer's Status entry (`/reports/latest`) resolves
  // to a `/reports/[id]` detail page, so for a viewer a report detail path must
  // light **Status**, not History — clicking Status and seeing History
  // highlighted is the reported bug. History stays lit only on the bare
  // `/reports` list. Scoped to the viewer so the head/lead History-active
  // contract (lead-history-summary, lit on published-report paths) is untouched.
  if (isViewer(role)) {
    if (href === REPORTS_LATEST_ROUTE) {
      return pathname === REPORTS_LATEST_ROUTE || isReportDetailPath(pathname);
    }
    if (href === "/reports") {
      return pathname === "/reports";
    }
  }
  if (href === "/reports") {
    // History active state is pathname-based only — independent of the archive
    // toggle and of any stray `?tab` param.
    // Exact match (not startsWith) so report subpaths are matched by the
    // detail-path check, not this History branch.
    return pathname === "/reports" || isReportDetailPath(pathname);
  }
  return pathname.startsWith(href);
}

export const getLogoHref = (role: Role) => ROLE_HOME_PATH[role];
