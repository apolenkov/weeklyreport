import {
  BarChart3,
  Clock,
  FileText,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import {
  ADMIN_ROUTE,
  HEAD_DASHBOARD_ROUTE,
  HEAD_REPORT_ROUTE,
  LEAD_REPORT_ROUTE,
  REPORTS_LATEST_ROUTE,
  REPORTS_ROUTE,
} from "./nav-links";

const NAV_ICON_COMMON = {
  size: 14,
  strokeWidth: 2,
  "aria-hidden": true,
} as const;

export function NavIcon({ href }: { readonly href: string }) {
  switch (href) {
    // Lead report and viewer status both show the document-icon.
    case LEAD_REPORT_ROUTE:
    case REPORTS_LATEST_ROUTE:
      return <FileText {...NAV_ICON_COMMON} />;
    case REPORTS_ROUTE:
      return <Clock {...NAV_ICON_COMMON} />;
    case HEAD_DASHBOARD_ROUTE:
      return <LayoutDashboard {...NAV_ICON_COMMON} />;
    case HEAD_REPORT_ROUTE:
      return <BarChart3 {...NAV_ICON_COMMON} />;
    case ADMIN_ROUTE:
      return <Settings {...NAV_ICON_COMMON} />;
    default:
      return null;
  }
}
