import { redirect } from "next/navigation";

/**
 * UX-17 (Phase 35-08): the legacy `/lead/history` and `/reports/history`
 * pages collapse into a single `/reports` page that renders one
 * role-defaulted history view (the lead sees their personal history). The
 * page has no tab state, so this route 307-redirects to `/reports` with no
 * query parameter.
 *
 * Next 16: `redirect()` from `next/navigation` issues a 307 by default
 * for this server-component path.
 */
export default function LeadHistoryRedirect() {
  redirect("/reports");
}
