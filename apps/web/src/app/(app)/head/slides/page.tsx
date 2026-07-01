import { redirect } from "next/navigation";

/**
 * `/head/slides` is a legacy alias that collapses into the shared `/reports`
 * page. `/reports` renders one role-defaulted history view with no tab or mode
 * state, so this redirects there with no query parameter (matching
 * `/head/history` and `/lead/history`).
 *
 * Next 16: `redirect()` issues a 307 by default for this server-component path.
 */
export default function HeadSlidesPage() {
  redirect("/reports");
}
