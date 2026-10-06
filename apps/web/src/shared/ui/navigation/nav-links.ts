import type { Role } from "@customreport/shared";

export interface NavLink {
  href: string;
  label: string;
  title?: string;
  // Roles that should SEE this link in nav. Tighter than route-access
  // (head/admin can technically open /lead/report but should not see it
  // in their nav — lead-prefix routes are personal lead data, head has
  // their own dashboard for the same intent).
  roles: readonly Role[];
  feature?: "productFeedback";
}

const HISTORY_LINK_TITLE = "Past weeks and closed reports";
export const LEAD_REPORT_ROUTE = "/lead/report";
export const REPORTS_ROUTE = "/reports";
export const ADMIN_ROUTE = "/admin";
export const PDF_EXPORTS_ROUTE = "/pdf-exports";
export const REPORTS_LATEST_ROUTE = "/reports/latest";
const REPORTS_TRENDS_ROUTE = "/reports/trends";
export const HEAD_DASHBOARD_ROUTE = "/head/dashboard";
export const HEAD_REPORT_ROUTE = "/head/report";
const FEEDBACK_ROUTE = "/feedback";

export const NAV_LINKS: readonly NavLink[] = [
  { href: LEAD_REPORT_ROUTE, label: "Report", roles: ["lead"] },
  // One History page for both active and archived report periods; archived
  // visibility is a local toggle inside the page. The link targets bare
  // `/reports` — the page does not read a `tab` query param.
  {
    href: REPORTS_ROUTE,
    label: "History",
    title: HISTORY_LINK_TITLE,
    roles: ["lead"],
  },
  // Heads use the same published history surface as viewers.
  {
    href: REPORTS_ROUTE,
    label: "History",
    title: HISTORY_LINK_TITLE,
    roles: ["head"],
  },
  // viewer-live-status: the viewer is a status observer of the
  // current period. The entry resolves the Status target (the current editable
  // period, else the latest visible published report) via the static
  // `/reports/latest` route, which redirects to the resolved report.
  {
    href: REPORTS_LATEST_ROUTE,
    label: "Status",
    title: "Open the current status report",
    roles: ["viewer"],
  },
  {
    href: REPORTS_ROUTE,
    label: "History",
    title: HISTORY_LINK_TITLE,
    roles: ["viewer"],
  },
  { href: HEAD_DASHBOARD_ROUTE, label: "Dashboard", roles: ["head"] },
  { href: HEAD_REPORT_ROUTE, label: "Status", roles: ["head"] },
  // Trends is an any-role analytics surface; without a nav entry the page is
  // unreachable except by URL and no item lights while visiting it.
  {
    href: REPORTS_TRENDS_ROUTE,
    label: "Trends",
    title: "Status and risk changes over recent periods",
    roles: ["lead", "head", "admin", "viewer"],
  },
  // Slides is a mode toggle inside Status/History, not a separate nav
  // destination.
  // admin tab is admin-only. heads have a dashboard, not an admin panel.
  // The /admin/layout.tsx role gate enforces the same on the route.
  { href: ADMIN_ROUTE, label: "Admin", roles: ["admin"] },
  // DB-backed recovery list for quarantined PDF exports — a head responsibility,
  // so the route is HEAD_ROUTE_ROLES-gated, not trapped inside admin-only UI.
  {
    href: PDF_EXPORTS_ROUTE,
    label: "PDF exports",
    title: "Failed PDF exports and how to retry them",
    roles: ["head", "admin"],
  },
  {
    href: FEEDBACK_ROUTE,
    label: "Feedback",
    roles: ["lead", "head", "admin", "viewer"],
    feature: "productFeedback",
  },
];
