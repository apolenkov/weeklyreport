# Log Coverage Audit - 2026-05-08

## Verdict

Status: active hardening.

The project already has structured API logging, tRPC request envelopes, browser
log forwarding, Prometheus metrics, and audit events. The regression gap was
not "no logs"; it was that product-critical errors were not asserted with
enough domain context.

## Existing Coverage

| Area             | Current mechanism                                                                   | Evidence                                            |
| ---------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| API request logs | HTTP middleware emits method, path, status, duration, IP, user-agent                | apps/api/src/main.ts                                |
| tRPC logs        | start/end/error envelope with procedure, type, userId, duration, error cause        | apps/api/src/infrastructure/trpc/trpc.middleware.ts |
| Browser logs     | console.error/warn, window error, unhandled rejection forwarded to /api/client-logs | apps/web/src/lib/client-logger.ts                   |
| File logs        | AppLogger writes JSON lines to LOG_DIR/app.log with rotation                        | apps/api/src/lib/logger.ts                          |
| Metrics          | Prometheus /metrics, HTTP and tRPC duration histograms                              | apps/api/src/infrastructure/metrics                 |
| Security audit   | login/logout/role-denied and mutation audit envelopes                               | apps/api/src/lib/audit-logger.ts                    |

## Fixes Applied In This Pass

| Problem                                                 | Fix                                                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| WeeklyReportDomainError became generic Unexpected error | mapDomainError now maps it to NOT_FOUND with the original message and cause                   |
| weeklyReport.get logs lacked role/report context        | router logs success/failure with userId, role, requestedReportId, resolvedReportId and counts |
| tRPC logs lacked role                                   | tRPC start/end/error envelopes now include role                                               |
| Browser toasts were not forwarded as structured errors  | dashboard and weekly report pages now call logClientError before toast.error                  |
| leadForm.byPeriod missing-section path was generic      | LeadFormDomainError maps to NOT_FOUND and logs reportId/requestedAuthorId/role                |
| head/admin could hit /lead/report without an authorId   | LeadForm redirects to the head report/dashboard and does not fire leadForm.byPeriod           |
| Lead form query errors lacked browser context           | LeadForm now forwards active/byPeriod/versions/history failures through logClientError        |

## Required Regression Assertions

| ID             | Scenario                                    | Required log evidence                                                                                   |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| LOG-WEEKLY-001 | Open weekly report with missing reportId    | API log contains weekly report load failed, procedure weeklyReport.get, role, userId, requestedReportId |
| LOG-WEEKLY-002 | WeeklyReportDomainError path                | Client sees specific not-found/no-active message, not Unexpected error                                  |
| LOG-WEEKLY-003 | Unknown weekly report failure               | API log contains tRPC error cause; browser log contains weeklyReport.get.load_failed and route context  |
| LOG-ROLE-001   | Lead opens head-only route                  | API log contains role-denied audit and tRPC role=lead                                                   |
| LOG-UI-001     | Product-ready Playwright scenario completes | Evidence JSON contains console, pageerror, requestfailed, screenshot paths, and timestamps              |
| LOG-LEAD-001   | Head opens /lead/report/:reportId           | Browser redirects to /head/report/:reportId and API has no leadForm.byPeriod error for the head user    |
| LOG-LEAD-002   | leadForm.byPeriod has no matching section   | API log contains lead form load failed with NOT_FOUND, role, reportId, requestedAuthorId                |

## Open Product Work

Persistent user action registry is still a separate product feature. It should
store user-visible activity such as item created, stage status changed, submit
dialog opened/confirmed, admin assignment changed, and export requested. That
is not the same as operational logs, and it needs its own schema and UI tab.
