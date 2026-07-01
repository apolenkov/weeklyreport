import { redirect } from "next/navigation";

/**
 * The legacy `/reports/history` archive page collapses into the merged
 * `/reports` route. `/reports` renders one role-defaulted history view with no
 * tab state (the archive toggle is local, non-URL), so this redirects there
 * with no query parameter (matching `/lead/history` and `/head/history`).
 *
 * Next 16: `redirect()` issues a 307 by default for this server-component path.
 */
export default function ReportsHistoryRedirect() {
  redirect("/reports");
}
