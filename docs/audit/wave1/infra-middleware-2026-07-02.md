# Per-file audit — apps/api/src/infrastructure/middleware (2026-07-02)

Read-only audit, wave 1. 1 file verified (`correlation-id.middleware.ts`; its
paired `.test.ts` was not separately audited). 1 finding kept, 0 killed.

## correlation-id.middleware.ts (1 finding)

| Lines       | Dimension | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Suggestion                                                                                                                                                                                                                                                                                                                           | Your verdict |
| ----------- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 18,23,24,27 | constants | low      | Header name `"x-request-id"` (used 3x here, also at `apps/api/src/infrastructure/trpc/trpc.context.ts:243`) and CLS store key `"correlationId"` (line 27, duplicated as `CORRELATION_ID_KEY = "correlationId"` in `apps/api/src/infrastructure/bullmq/worker-observability.ts:11` and as a raw literal in `apps/api/src/lib/logger.ts:251`) are inlined string literals instead of one named, exported constant. A rename/typo in any one of the 4 call sites silently breaks correlation-id propagation with no compiler error. | Extract `REQUEST_ID_HEADER = "x-request-id"` and `CORRELATION_ID_CLS_KEY = "correlationId"` into one small shared module (e.g. `apps/api/src/lib/correlation.ts`) and import it from `correlation-id.middleware.ts`, `trpc.context.ts`, `worker-observability.ts`, and `logger.ts` instead of each re-declaring/inlining the string. |              |

Already good: 30-line file, single ~10-line function doing exactly one thing (validate-or-generate + propagate a correlation id); comments are non-obvious WHY within budget (security rationale for the regex allowlist, why CLS instead of threading a parameter); `VALID_REQUEST_ID` is a well-named documented constant rather than an inline regex at the call site; fully immutable (`const` throughout, no reassignment — `req.headers` mutation is the middleware's necessary side effect, not incidental state mutation).

## Rollup

**By dimension:** constants — 1 (low).

**By severity:** low — 1. No medium/high/critical findings.

**Top-3 highest-impact:** only one finding exists — the `x-request-id` /
`correlationId` string-literal duplication across 4 files (middleware, tRPC
context, BullMQ worker-observability, logger). Ranked #1 by default; no #2/#3.

**Pending-openspec overlap:** none of the pending changes listed
(unified-activity-entry, fix-manual-publish-archive-race,
head-surface-parity-declutter, responsive-compact-layout,
project-activity-reporting, review-acknowledgement,
input-and-error-hardening, enforce-deactivation-pdf-bullboard,
code-health-and-test-cleanup, scope-period-lifecycle-authz,
fix-carryover-persistence, fix-heap-health-threshold,
fix-dashboard-nan-pending, ci-deploy-supplychain-hardening,
protect-metrics-endpoint, serialize-autosave,
fix-risk-stage-integrity-impl, observe-prisma-pool,
harden-web-vitals-endpoint, fix-reminders-escalation-dedupe,
observability-and-perf-hardening, tighten-code-quality-ratchet,
guard-metrics-scrape-db-failure, fix-period-datetime-tz, key-charts-by-id,
enforce-smtp-config, fix-analytics-date-matching,
period-uniqueness-db-constraint, fix-prod-web-build-args,
scope-leadform-getbyperiod, make-publish-atomic, map-domain-errors,
scope-leadform-revoke-authz, guard-autopublish-archived,
scope-reminder-authz, transactional-snapshot-restore,
add-section-optimistic-lock, scope-analytics-to-group,
route-pdfs-and-authz, escape-org-data-script, set-express-trust-proxy,
fix-open-redirect-next-param, tighten-comment-policy) covers correlation-id
propagation or its constant hygiene. `observe-prisma-pool` and
`observability-and-perf-hardening` are the closest neighbors by theme
(observability), but neither's scope touches this specific header/CLS-key
duplication — the finding is a plain style sweep, not folded into any
pending change.

## Killed by verification

None — the single finding submitted survived verification unchanged.
