import { redirect } from "next/navigation";

/**
 * UAT 2026-05-22 (user decision): /head/history collapses into the shared
 * /reports page (tab=published) — the same surface the viewer role uses for
 * compiled history. This matches how /lead/history redirects to
 * /reports?tab=drafts (Phase 35-08 / UX-17).
 *
 * Next 16: redirect() issues a 307 by default for this server-component path.
 */
export default function HeadHistoryRedirect() {
  redirect("/reports?tab=published");
}
