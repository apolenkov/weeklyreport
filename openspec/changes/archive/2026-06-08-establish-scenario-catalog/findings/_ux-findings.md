# UX-tier findings — live DOM capture (role × route), 2026-06-03 night

Captured the real running DOM under 4 roles (head/lead/admin/viewer) × 17 routes
via Playwright. 194 UI scenarios in `ui-*.feature`; access matrix in `_ux-matrix.md`.
Denials per role: head 1, lead 6, admin 6, viewer 10 (sensible least-privilege gradient).

## Verified finding (code-confirmed) — preview route lacks role guard

**`/lead/report/:id/preview` is reachable by head AND admin** (accessGranted=true),
unlike its sibling `/lead/*` routes which redirect non-leads away.

Root cause (read in code):

- `apps/web/src/proxy.ts` — middleware checks SESSION EXISTENCE ONLY, not role
  ("Role separation lives in v6.0 — this file only checks session existence").
- `app/(app)/lead/report/[reportId]/preview/page.tsx` — server shell, no role guard;
  delegates auth to `LeadSectionPreviewAuth`.
- `components/lead/lead-section-preview-auth.tsx` — NO role check; resolves the
  CURRENT user's `userId` from `auth.me` and renders `WeeklyReportPage` filtered to
  `authorId = current user`.

Severity: LOW — not a data leak (the report is self-scoped to the viewer's own
authorId; head/admin see only their own/empty section). But it is a genuine
inconsistency: a `/lead`-prefixed route with no per-page role gate while siblings
redirect. Recommend: add the same role guard the sibling pages use, OR confirm the
preview is intentionally cross-role and document it. DO NOT fix without sign-off.

Companion bug A6: this page throws a React hydration mismatch
(`WeeklyReportSkeleton` role/aria-busy/aria-label) for lead and admin (1 console
error each) — will cause flaky tests; head logs 0.

## Access anomalies surfaced by the capture (A1–A8, for verification)

- **A1** `/head/history`, `/head/slides`: head granted on redirect to
  `/reports?tab=published`, but admin denied on the identical redirect. Same
  destination, different classification.
- **A2** `/lead/report/:id`: head cross-role redirected to `/head/report/:id`
  (accessGranted=false) but lands on a valid page — classification may cause test
  false-positives.
- **A3** `/lead/report/:id/preview`: head + admin reach it (accessGranted=true) —
  the over-grant verified above.
- **A4/A5** Systematic admin denial on redirect-aliases: on `/head/history`,
  `/head/slides`, `/lead/history`, `/lead/report/:id`, `/reports/history` admin
  arrives at the same destination as the granted role but is classified
  accessGranted=false where other roles are true. Likely a role-home resolution
  artifact in the authz path — warrants verification.
- **A6** React hydration mismatch on `/lead/report/:id/preview` (lead, admin).
- **A7** Viewer denial mechanism differs: viewer sees an in-page wall ("Page
  unavailable for your role", URL unchanged) on `/head/*` and `/lead/*`, while
  lead/admin are redirected away. Two different denial UX patterns.
- **A8** `/lead/report`: head + admin bounced to role home (`/head/dashboard`)
  rather than an in-page wall, losing the attempted-route context.

NOTE: A1/A2/A4/A5 are "classification" nuances of accessGranted (redirect to a
valid page the role CAN see vs a true denial). They are not necessarily bugs, but
the catalog flags them so the UI authz model is made explicit. A3 + A6 are the
two concrete items to act on.
