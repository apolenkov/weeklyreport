import { redirect } from "next/navigation";

/**
 * UX-17 (Phase 35-08): the legacy `/reports/history` archive page is now
 * the "Published" tab on the merged `/reports` route. This handler
 * 307-redirects to it.
 */
export default function ReportsHistoryRedirect() {
  redirect("/reports?tab=published");
}
