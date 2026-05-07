# Product Ready Report — 2026-05-07

## Verdict

**Status: product-ready for the repaired scope and current regression gate.**

The code gates, build, focused regression slices, clean-state progressive
role scenario, full live regression suite, API health checks, screenshot
capture, and UI review all ran.

## Scope Closed

- Static UI chrome is English; Russian remains valid only for business/report
  content and seeded report data.
- Head/admin can deep-link into a lead-authored report section via `authorId`
  in read-only mode.
- Leads cannot use `authorId` to read or edit another lead section.
- Weekly report displays the configured department name from app settings.
- Dashboard lead cards and report product cards expose pointer/hover affordance.
- Product sections without submitted content are disabled and display an empty
  state instead of acting like collapsible content.
- Export PDF is enabled for exportable report states and correctly disabled
  with a publish-first reason for draft/live states.
- React duplicate-key risk in dashboard pending-lead fragments is fixed.
- Shared UI buttons now expose explicit pointer/not-allowed cursor states.

## Verification Matrix

| Gate                                       | Result | Evidence                                                              |
| ------------------------------------------ | -----: | --------------------------------------------------------------------- |
| Web typecheck                              |   PASS | `rtk pnpm -C apps/web typecheck`                                      |
| API typecheck                              |   PASS | `rtk pnpm -C apps/api typecheck`                                      |
| Full lint                                  |   PASS | `rtk proxy pnpm lint` — 4/4 packages                                  |
| Full unit/contract tests                   |   PASS | `rtk proxy pnpm test` — shared 452, api 644, web 262                  |
| Full build                                 |   PASS | `rtk proxy pnpm build` — 5/5 tasks                                    |
| Static chrome Cyrillic grep                |   PASS | no matches in runtime `app/components/lib`, excluding tests/mock data |
| Agent C dashboard/report/archive/PDF slice |   PASS | 32/32                                                                 |
| Agent B quick reminders/jobs slice         |   PASS | 3/3                                                                   |
| Agent A archive slice                      |   PASS | 10/10                                                                 |
| Clean-state progressive role scenario      |   PASS | 1/1 with wipe/reseed                                                  |
| Full live regression corpus                |   PASS | 179/179                                                               |
| API health                                 |   PASS | `/health/live`, `/health/ready` ok                                    |
| Graphify refresh                           |   PASS | 1494 nodes, 1643 edges, 284 communities                               |

## Progressive Role Scenario

File:
`apps/web/e2e/regression/product-ready-progressive.spec.ts`

Flow:

`[admin login] --> [wipe/reseed advanced] --> [viewer archive] --> [lead form] --> [head dashboard] --> [head author report] --> [admin users/products/reminders/jobs]`

Captured evidence:

- `.planning/regression/evidence/product-ready-progressive/01-viewer-published-archive.png`
- `.planning/regression/evidence/product-ready-progressive/02-lead-report-form.png`
- `.planning/regression/evidence/product-ready-progressive/03-head-dashboard.png`
- `.planning/regression/evidence/product-ready-progressive/04-head-author-report.png`
- `.planning/regression/evidence/product-ready-progressive/05-weekly-report-products.png`
- `.planning/regression/evidence/product-ready-progressive/06-admin-users.png`
- `.planning/regression/evidence/product-ready-progressive/07-admin-products.png`
- `.planning/regression/evidence/product-ready-progressive/08-admin-reminders.png`
- `.planning/regression/evidence/product-ready-progressive/09-admin-jobs.png`
- `.planning/regression/evidence/product-ready-progressive/network-and-page-log.json`

Log summary from the passing run:

- total captured network/page events: 25
- tRPC 2xx: 21
- tRPC 4xx: 0
- tRPC 5xx: 0
- page errors: 0
- request failures: 4, all `net::ERR_ABORTED` from intentional route
  transitions

## Domain Coverage Audit

Deep audit result: the domain model is broadly represented in unit/contract
tests, but browser regression coverage is still partial. The biggest gap is
quality of assertions, not absence of files: several old scenarios accept
optional branches, smoke-only visibility, or `count >= 0` style assertions.

Current coverage classification:

| Domain area                             |                      Current coverage | Release implication                                                                   |
| --------------------------------------- | ------------------------------------: | ------------------------------------------------------------------------------------- |
| Users, roles, session, auth             |                               Partial | Progressive scenario now covers role entry; route/API adversarial matrix still needed |
| Report lifecycle publish/reopen/archive |                               Partial | Core slices pass; full deterministic lifecycle should replace stale old specs         |
| Lead section capture/submit lock        |                               Partial | Backend strong; UI submit-lock exactness needs stronger clean-state assertions        |
| Project/stage ownership                 |                               Partial | Needs direct negative mutation checks for unowned stages                              |
| Items/risks/decisions/priorities        |                               Partial | CRUD exists; carry-over and duplicate-prevention paths need exact fixture tests       |
| PDF/export                              |                               Partial | UI/export state covered; worker/file delivery should be CI-gated separately           |
| Reminders/jobs                          |                               Partial | UI/jobs pass; mail delivery/dedupe/e2e reminder flow needs fixture-driven test        |
| Analytics/search/AI                     | Weak to missing in browser regression | Service tests exist; browser smoke should be added after lifecycle suite cleanup      |

## UI Review

Artifact:
`.planning/reports/UI-REVIEW-2026-05-07.md`

Automated score: **11/24**. After review:

- Applied duplicate-key fix.
- Applied shared button cursor fix.
- Rejected Russian static-chrome recommendation because the accepted product
  rule is English static UI plus Russian business content.
- Downgraded unauthenticated route-capture blocker because the authenticated
  progressive role scenario passed.

Screenshot binaries are kept locally and ignored from git under
`.planning/ui-reviews/`.

## Full Regression Run

The full live suite was brought from **140 passed / 39 failed** during this
handoff to **179 passed / 179 total**. The remaining failures were stale
endpoint assumptions, old admin table assumptions, weak auth helpers, and
state-pollution from destructive tests. Those were repaired in the regression
suite and verified by a final full run.

The new product-ready regression pattern is:

`[wipe/reseed] --> [role-progressive lifecycle] --> [exact UI/API assertions] --> [screenshots/log evidence]`

## Local Stack

- Web: `http://localhost:3000`
- API: `http://localhost:3002`
- Last checked API readiness: database, redis, BullMQ, memory all `up`.
