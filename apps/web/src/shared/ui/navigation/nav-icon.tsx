import {
  BarChart3,
  Clock,
  FileText,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import {
  HEAD_DASHBOARD_ROUTE,
  HEAD_REPORT_ROUTE,
  REPORTS_LATEST_ROUTE,
} from "./nav-links";

export function NavIcon({ href }: { readonly href: string }) {
  const common = { size: 14, strokeWidth: 2, "aria-hidden": true };
  switch (href) {
    case "/lead/report":
      return <FileText {...common} />;
    case REPORTS_LATEST_ROUTE:
      return <FileText {...common} />;
    case "/reports":
      return <Clock {...common} />;
    case HEAD_DASHBOARD_ROUTE:
      return <LayoutDashboard {...common} />;
    case HEAD_REPORT_ROUTE:
      return <BarChart3 {...common} />;
    case "/admin":
      return <Settings {...common} />;
    default:
      return null;
  }
}
