# Per-file audit — apps/api/src/infrastructure/email (2026-07-02)

Read-only calibration audit, wave 1.
1 file scanned, 4 findings kept, 0 killed.
No fixes applied — this report is input to a later triage/backlog decision.

## email.service.ts (4 findings)

| Lines  | Dimension   | Severity | Finding                                                                                                                                                                                                     | Suggestion                                                                                                                                                                             | Your verdict |
| ------ | ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 14-22  | comments    | medium   | 9-line JSDoc header on the class narrates behavior already obvious from reading sendMail/constructor (dev-vs-prod transport selection), well over the 3-line budget for non-obvious WHY.                    | Cut to <=3 lines keeping only the load-bearing WHY (env.schema fails closed in prod so jsonTransport can't leak there); drop the rest as narration.                                    |              |
| 50-55  | comments    | medium   | 6-line JSDoc carries a ticket/phase reference (UFB-048 / Phase 50-A) — change-log archaeology explicitly called out as noise by the comment policy.                                                         | Delete the ticket/phase prefix; if the rationale (per-call from override avoids mutating shared state) is load-bearing, relocate to an ADR/spec and leave a <=2-line pointer comment.  |              |
| 83-91  | comments    | medium   | 9-line JSDoc carries two ticket/phase references (NOTIF-03/Phase 28-03, UFB-048/Phase 50-A) plus narration on why multipart helps spam scoring — over budget and archaeology.                               | Delete ticket/phase prefixes via git-history; if the spam-scoring rationale is load-bearing, relocate to a spec/ADR with a <=2-line pointer here.                                      |              |
| 56-119 | duplication | low      | sendMail and sendMailMultipart duplicate the entire dev/jsonTransport stdout-logging block (lines 70-80 vs 108-118), differing only in the log message string and whether html is included in the envelope. | Extract a private logDevSend(fromAddr, to, subject, extra?) helper (or a single sendMail(payload) taking an options object with optional html) to remove the ~10-line duplicate block. |              |

Already good: named constants (DEV_JSON_TRANSPORT_FROM, DEFAULT_SMTP_PORT) instead of inline magic literals, each with a 1-line WHY comment within budget; env values read once from the injected validated EnvConfig (no ad-hoc process.env, no zod `.default` hiding a mandatory var) — production fails closed on missing SMTP_HOST per env.schema; single-purpose infrastructure module with no duplicate ad-hoc nodemailer usage elsewhere; file is 121 lines, both public methods well under the 50-line function threshold, low cognitive complexity throughout.

## Rollup

**By dimension:** comments — 3 (all medium); duplication — 1 (low).

**By severity:** medium — 3; low — 1; high/critical — 0.

**Top-3 highest-impact:**

1. Lines 83-91 — 9-line JSDoc, worst comment-budget overshoot, two stacked ticket refs.
2. Lines 14-22 — 9-line class-header JSDoc narrating obvious behavior.
3. Lines 50-55 — 6-line JSDoc with a single ticket/phase ref.

**Openspec overlap:** none of the 4 findings map to any pending change in the list (unified-activity-entry, fix-manual-publish-archive-race, head-surface-parity-declutter, responsive-compact-layout, project-activity-reporting, review-acknowledgement, input-and-error-hardening, enforce-deactivation-pdf-bullboard, code-health-and-test-cleanup, scope-period-lifecycle-authz, fix-carryover-persistence, fix-heap-health-threshold, fix-dashboard-nan-pending, ci-deploy-supplychain-hardening, protect-metrics-endpoint, serialize-autosave, fix-risk-stage-integrity-impl, observe-prisma-pool, harden-web-vitals-endpoint, fix-reminders-escalation-dedupe, observability-and-perf-hardening, tighten-code-quality-ratchet, guard-metrics-scrape-db-failure, fix-period-datetime-tz, key-charts-by-id, enforce-smtp-config, fix-analytics-date-matching, period-uniqueness-db-constraint, fix-prod-web-build-args, scope-leadform-getbyperiod, make-publish-atomic, map-domain-errors, scope-leadform-revoke-authz, guard-autopublish-archived, scope-reminder-authz, transactional-snapshot-restore, add-section-optimistic-lock, scope-analytics-to-group, route-pdfs-and-authz, escape-org-data-script, set-express-trust-proxy, fix-open-redirect-next-param, tighten-comment-policy). `enforce-smtp-config` touches this same file's SMTP env handling but that change is about config enforcement, not comment/duplication cleanup — no overlap with these findings. All 4 are plain comment-hygiene / duplication cleanup, safe for a standalone style sweep rather than folded into an existing change.

## Killed by verification

None — all 4 candidate findings survived verification and are listed above as kept.
