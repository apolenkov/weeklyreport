# Fix UI role-access inconsistencies on the lead preview route

## Problem

Live-DOM capture under all four roles surfaced inconsistencies in how the web app
gates and denies routes. Two are concrete bugs; the rest are UX inconsistencies
worth reconciling.

Concrete:

- **`/lead/report/:id/preview` has no per-page role guard.** `proxy.ts` checks
  session existence only (role separation deferred to "v6.0"); the preview page
  (`app/(app)/lead/report/[reportId]/preview/page.tsx`) delegates to
  `components/lead/lead-section-preview-auth.tsx`, which enforces NO role — it
  reads the current user's `userId` and renders `WeeklyReportPage` scoped to that
  authorId. So head and admin reach this `/lead`-prefixed route (accessGranted),
  while sibling `/lead/*` routes redirect non-leads. Not a data leak (output is
  self-scoped), but an inconsistent access surface.
- **React hydration mismatch** on that same page for lead and admin:
  `WeeklyReportSkeleton` role / aria-busy / aria-label mismatch logs 1 console
  error per load — a real defect that also makes any future test of this page flaky.

UX inconsistencies (lower priority, reconcile the model):

- The access-wall "Go to dashboard" link is hardcoded to `/head/dashboard` for ALL
  denied roles; lead's home is `/lead/report`, viewer's is `/reports?tab=published`.
- Two different denial patterns coexist: viewer sees an in-page wall (URL
  unchanged), while lead/admin are redirected away — inconsistent UX for the same
  "not allowed" outcome.

## Solution

- Add a per-page role guard to the preview route consistent with its `/lead/*`
  siblings (redirect non-leads), OR explicitly decide the preview is intentionally
  cross-role and document that intent. (Human decision required on intent.)
- Fix the `WeeklyReportSkeleton` hydration mismatch (align server/client
  role/aria-busy/aria-label).
- Make the access-wall home link resolve from the visitor's role via the existing
  `role-home` helper instead of hardcoding `/head/dashboard`.
- Decide on ONE denial pattern (in-page wall vs redirect) and apply it uniformly.

## Non-goals

- No new "director" runtime role (out of scope per repo rules).
- Does not move role enforcement into `proxy.ts` middleware — per-page/per-layout
  guards remain the model.
- Does not address the admin role-model drift (separate change) or the
  period-dual-state spec drift (separate change).
