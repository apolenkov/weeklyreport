import { redirect } from 'next/navigation';

/**
 * UX-17 (Phase 35-08): the legacy `/lead/history` and `/reports/history`
 * pages were two different surfaces showing similar things ("my drafts"
 * vs "everyone's published"). They now collapse into a single `/reports`
 * page with role-default tabs. This route 307-redirects to the merged
 * page with the "Мои черновики" tab pre-selected.
 *
 * Next 16: `redirect()` from `next/navigation` issues a 307 by default
 * for this server-component path.
 */
export default function LeadHistoryRedirect() {
  redirect('/reports?tab=drafts');
}
