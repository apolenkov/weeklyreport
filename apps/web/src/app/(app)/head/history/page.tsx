import { redirect } from "next/navigation";

/**
 * /head/history collapses into the shared /reports page — the same surface
 * the viewer role uses for compiled history. The page renders one
 * role-defaulted history view with no tab state, so this redirects to
 * /reports with no query parameter (matching /lead/history).
 *
 * Next 16: redirect() issues a 307 by default for this server-component path.
 */
export default function HeadHistoryRedirect() {
  redirect("/reports");
}
