# Product Ready Report - 2026-05-07

## Verdict

**Status:** PASS for the current product-ready gate.

This report closes the regression/UI review pass for the v8.1 polish wave.
It does not archive v8.1 as a completed milestone: `.planning/STATE.md`
currently marks v8.1 as in progress with phases 40-42 at 0/12 plans complete.
v8.0 is already shipped and remains the production baseline.

## Gates

| Gate                    | Result                | Evidence                                       |
| ----------------------- | --------------------- | ---------------------------------------------- |
| TypeScript              | PASS                  | `rtk proxy pnpm typecheck`                     |
| Lint                    | PASS                  | `rtk proxy pnpm lint`                          |
| Unit tests              | PASS                  | `rtk proxy pnpm test`                          |
| Production build        | PASS                  | `rtk proxy pnpm build`                         |
| Full browser regression | PASS                  | 83/83 Playwright scenarios                     |
| UI review               | PASS with no blockers | `.planning/regression/UI-REVIEW-2026-05-07.md` |
| Knowledge graph         | PASS                  | `rtk graphify update .`                        |

## Unit Test Counts

| Package                |                Result |
| ---------------------- | --------------------: |
| `@customreport/shared` |            452 passed |
| `@customreport/api`    |            644 passed |
| `@customreport/web`    |            263 passed |
| `@customreport/ui`     | typecheck test passed |

Known non-blocking warnings:

- Vitest emits `--localstorage-file` warning from the test environment.
- Recharts emits width/height warnings in chart unit tests.
- SAML test fixture emits a missing SingleLogoutService endpoint warning.

## Regression Scenario Status

| Area                     | Status | Coverage                                                                                                                                            |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archive/history          | PASS   | `ARC-001..010`                                                                                                                                      |
| Lead report form         | PASS   | `LEAD-001`, `004`, `006`, `010..012`, `020`, `031`, `035`, `040..049`, `060`, `070`, `080..081`, `090`, `097`, period nav, toggle-all, at-risk icon |
| Admin panel              | PASS   | users, products, periods, reminders, reopen, jobs, settings, snapshot                                                                               |
| Head dashboard           | PASS   | dashboard shell, weekly report link, activity panel, lead statuses, polling, progress badge, role access                                            |
| Assembled weekly report  | PASS   | canonical route, skeleton, portfolio table, accordions, click-through, publish dialog, role guard, status aggregation                               |
| Print/PDF                | PASS   | print route, page CSS, Cyrillic glyphs, `page.pdf()`, PDF export job request/status/artifact                                                        |
| Progressive role journey | PASS   | wipe/reseed, viewer, lead, head, admin, screenshots, network/page log                                                                               |

## User-Reported Issues

| Request / Issue                                               | Status | Resolution                                                                                                    |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Static navigation/UI text should stay English                 | PASS   | Regression verifies English static labels; dynamic seeded content may be Russian.                             |
| `Reminders` appeared empty                                    | PASS   | Admin reminders tab now has regression coverage for rule controls and evidence screenshot.                    |
| Clickable regions need pointer/hover clarity                  | PASS   | Lead/dashboard links already covered; archive cards now add pointer, hover elevation, and focus-visible ring. |
| Dashboard row should deep-link to the author's report section | PASS   | Activity rows now route to `/head/report/<reportId>?authorId=<leadId>`.                                       |
| Author report deep-link should open only the relevant section | PASS   | Regression asserts at most one product accordion expanded and empty sections stay disabled.                   |
| Empty product sections should not feel closable/expandable    | PASS   | Empty product rows are disabled, muted, and show no chevron.                                                  |
| Disabled PDF export was unclear                               | PASS   | Disabled label now reads `Publish to export PDF` and exposes an accessible reason.                            |
| Department name changes should apply to report context        | PASS   | Weekly report read model uses `departmentName`; page tests cover label update.                                |
| Static Russian labels introduced by mistake                   | PASS   | Current audited static chrome is English; Russian remains content/seed data only.                             |
| Screenshots/logs required for review                          | PASS   | 9 role-flow screenshots plus network/page log captured.                                                       |

## Evidence Files

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

## Residual Risk

No HIGH or MEDIUM blockers remain from code review, UI review, or regression.
Low-risk polish remains around broader color/typography token consolidation,
but it is not blocking the current product-ready gate.
