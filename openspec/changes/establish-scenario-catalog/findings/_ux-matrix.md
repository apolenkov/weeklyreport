# UX Access Matrix — Role × Route

Generated from Playwright capture across 4 roles × 17 routes.

Legend:

- `✓` — granted (finalUrl matches requested route, or is an expected functional alias)
- `✗ → <url>` — denied; value is the redirect target
- `(in-page)` — URL unchanged, content blocked in-page ("Page unavailable for your role")
- `ERR:N` — N console errors on that page (errors only; recharts width/height warnings excluded)

## Matrix

| Route                      | head                            | lead                            | admin                           | viewer                       | Console errors           |
| -------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ---------------------------- | ------------------------ |
| `/`                        | ✓                               | ✓                               | ✓                               | ✓                            | —                        |
| `/head/dashboard`          | ✓                               | ✗ (in-page)                     | ✓                               | ✗ (in-page)                  | —                        |
| `/head/history`            | ✓ → `/reports?tab=published`    | ✗ (in-page)                     | ✗ → `/reports?tab=published`    | ✗ (in-page)                  | —                        |
| `/head/report`             | ✓ → `/head/report/<current-id>` | ✗ (in-page)                     | ✓ → `/head/report/<current-id>` | ✗ (in-page)                  | —                        |
| `/head/report/:id`         | ✓                               | ✗ (in-page)                     | ✓                               | ✗ (in-page)                  | —                        |
| `/head/report/:id/present` | ✓                               | ✗ (in-page)                     | ✓                               | ✗ (in-page)                  | —                        |
| `/head/slides`             | ✓ → `/reports?tab=published`    | ✗ (in-page)                     | ✗ → `/reports?tab=published`    | ✗ (in-page)                  | —                        |
| `/lead/report`             | ✗ → `/head/dashboard`           | ✓ → `/lead/report/<current-id>` | ✗ → `/head/dashboard`           | ✗ (in-page)                  | —                        |
| `/lead/history`            | ✓ → `/reports?tab=drafts`       | ✓ → `/reports?tab=drafts`       | ✗ → `/reports?tab=drafts`       | ✗ (in-page)                  | —                        |
| `/lead/report/:id`         | ✓ → `/head/report/:id`          | ✓                               | ✗ → `/head/report/:id`          | ✗ (in-page)                  | —                        |
| `/lead/report/:id/preview` | ✓                               | ✓                               | ✓                               | ✗ (in-page)                  | lead ERR:1 · admin ERR:1 |
| `/reports`                 | ✓                               | ✓                               | ✓                               | ✓                            | —                        |
| `/reports/history`         | ✓ → `/reports?tab=published`    | ✓ → `/reports?tab=published`    | ✗ → `/reports?tab=published`    | ✓ → `/reports?tab=published` | —                        |
| `/reports/trends`          | ✓                               | ✓                               | ✓                               | ✓                            | —                        |
| `/reports/:id`             | ✓                               | ✓                               | ✓                               | ✓                            | —                        |
| `/reports/:id/present`     | ✓                               | ✓                               | ✓                               | ✓                            | —                        |
| `/print/:id`               | ✓                               | ✓                               | ✓                               | ✓                            | —                        |

## Anomalies and Notes

### A1 — `/head/history` and `/head/slides`: head granted on redirect, admin denied on same redirect

Both routes redirect to `/reports?tab=published`. Head is `accessGranted=true` on both (✓ redirect,
correct behaviour). Admin is `accessGranted=false` on both — same destination, same content, but
classified as a denial. See A4/A5 below for the consolidated pattern.

### A2 — `/lead/report/:id`: head gets silently re-routed to `/head/report/:id`

When head visits `/lead/report/:id`, the app redirects to the head-prefixed equivalent.
`accessGranted=false` is recorded. This is a cross-role redirect, not an authz block. No
in-page wall is shown; the user lands on a valid page. Functionally harmless but the
`accessGranted=false` classification may cause test false-positives.

### A3 — `/lead/report/:id/preview`: accessible to head and admin (possible over-grant)

Both head and admin land on this route with `accessGranted=true` and see "Section Preview".
If preview is a lead-only staging view (it lives under `/lead/`), head and admin reaching it
may be an authz leak. Lead and admin each produce 1 console error on this page (React hydration
mismatch in `WeeklyReportSkeleton`); head produces 0.
**Action:** confirm whether head/admin should reach this route; if not, add a role guard.

### A4/A5 — Admin systematically classified as denied on every redirect-alias

On five routes — `/head/history`, `/head/slides`, `/lead/history`, `/lead/report/:id`,
`/reports/history` — admin arrives at the same destination as head (or lead), sees the same
content, but the capture records `accessGranted=false`. Every other role reaching the same
redirect is `accessGranted=true`. This is a consistent pattern, not five separate issues.
Likely cause: the admin session resolves role-home differently during redirect, causing the
authz middleware to emit a denial signal even though the destination is accessible.
**Risk:** if this is a real gap (not a harness artifact), admin lacks access to several
redirect-alias routes that head sees as granted. Verify by checking the admin role guard
logic for redirect paths.

### A6 — React hydration mismatch on `/lead/report/:id/preview` (lead and admin)

Lead and admin each log 1 console error on this route (head has 0). The error is a hydration
mismatch in `WeeklyReportSkeleton` (role / aria-busy / aria-label attributes differ between
SSR and client render). Not a security issue, but it will cause flaky tests and should be fixed.

### A7 — Viewer: in-page wall for all `/head/*` and `/lead/*` routes

Viewer sees "Page unavailable for your role" without a redirect. URL stays unchanged.
This is a different denial mechanism from the redirect-based denial used for lead/admin on
head routes. Consistent within the viewer role; compare to lead's identical behaviour on
`/head/*` routes.

### A8 — `/lead/report`: head and admin redirect to role home (`/head/dashboard`) instead of blocking in-page

Head and admin hitting `/lead/report` are bounced to `/head/dashboard`. This is a role-home
redirect rather than an in-page wall or neutral redirect. Functionally correct but differs in
UX from the in-page wall viewer sees — the user loses the context of what they tried to visit.
