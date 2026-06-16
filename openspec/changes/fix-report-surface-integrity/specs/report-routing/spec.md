## ADDED Requirements

### Requirement: Present routes 308-redirect to slides mode

The legacy presentation routes MUST 308-redirect to slides mode.
`apps/web/src/app/(app)/head/report/[reportId]/present` and
`apps/web/src/app/(app)/reports/[reportId]/present` MUST respond with a
308 permanent redirect to the same report id with `?mode=slides`
appended (`/head/report/[reportId]?mode=slides` and
`/reports/[reportId]?mode=slides` respectively). The routes MUST NOT be
deleted, so existing deep links keep resolving.

#### Scenario: a head present deep link redirects to slides

- **WHEN** any client requests `/head/report/[reportId]/present`
- **THEN** the response is a 308 permanent redirect to
  `/head/report/[reportId]?mode=slides`

#### Scenario: a viewer present deep link redirects to slides

- **WHEN** any client requests `/reports/[reportId]/present`
- **THEN** the response is a 308 permanent redirect to
  `/reports/[reportId]?mode=slides`

### Requirement: The print route is the PDF-worker render template only

`apps/web/src/app/print/[reportId]/page.tsx` MUST remain the PDF
worker's render template. It MUST render the report only when invoked
WITH the PDF-worker export-job authentication context. A normal
authenticated human WITHOUT that worker context MUST receive a TEMPORARY
(307) redirect to a role-specific destination — temporary, not 308,
because the destination depends on the caller's session role and a
permanent redirect could be cached/served cross-role. An unauthenticated
request MUST be redirected to login.

- head or admin → `/head/report/[reportId]`
- viewer → `/reports/[reportId]`
- lead → the lead's own report (`/lead/report`, the "own" path). A lead
  human never renders the print template (only the worker token does), so
  there is no report data to expose and no FORBIDDEN page is required;
  per-report ownership resolution is intentionally not added.
- unauthenticated → login

#### Scenario: the PDF worker renders the print template

- **WHEN** the print route is requested with the PDF-worker export-job
  auth context for `[reportId]`
- **THEN** the route renders the report's print template

#### Scenario: a head human is redirected away from the print route

- **WHEN** an authenticated head requests `/print/[reportId]` without the
  worker export-job context
- **THEN** the response is a 307 temporary redirect to `/head/report/[reportId]`

#### Scenario: a viewer human is redirected away from the print route

- **WHEN** an authenticated viewer requests `/print/[reportId]` without
  the worker export-job context
- **THEN** the response is a 307 temporary redirect to `/reports/[reportId]`

#### Scenario: a lead is redirected to their own report

- **WHEN** an authenticated lead requests `/print/[reportId]` without the
  worker export-job context
- **THEN** the lead is redirected (307) to their own report (`/lead/report`)
- **AND** no report data is exposed and no FORBIDDEN page is required,
  because a lead human never renders the print template

#### Scenario: an unauthenticated request is sent to login

- **WHEN** an unauthenticated request hits `/print/[reportId]`
- **THEN** the request is redirected to login
