# Coverage matrix — finding -> OpenSpec change

_Сгенерировано 2026-06-29. 44 recommendedChanges -> 35 changes (Wave D свёрнут). Проверка: 100% покрыто._

| #   | recommendedChange                  | Приоритет | Реализующий change                          | Волна |
| --- | ---------------------------------- | --------- | ------------------------------------------- | ----- |
| 1   | fix-carryover-persistence          | P0        | `fix-carryover-persistence`                 | A     |
| 2   | fix-prod-web-build-args            | P0        | `fix-prod-web-build-args`                   | A     |
| 3   | route-pdfs-and-authz               | P0        | `route-pdfs-and-authz`                      | A     |
| 4   | set-express-trust-proxy            | P0        | `set-express-trust-proxy`                   | A     |
| 5   | scope-analytics-to-group           | P0        | `scope-analytics-to-group`                  | A     |
| 6   | scope-leadform-revoke-authz        | P0        | `scope-leadform-revoke-authz`               | A     |
| 7   | fix-open-redirect-next-param       | P0        | `fix-open-redirect-next-param`              | A     |
| 8   | escape-org-data-script             | P0        | `escape-org-data-script`                    | A     |
| 9   | add-section-optimistic-lock        | P0        | `add-section-optimistic-lock`               | A     |
| 10  | guard-autopublish-archived         | P0        | `guard-autopublish-archived`                | A     |
| 11  | scope-period-lifecycle-authz       | P1        | `scope-period-lifecycle-authz`              | B     |
| 12  | scope-reminder-authz               | P1        | `scope-reminder-authz`                      | B     |
| 13  | enforce-deactivation-pdf-bullboard | P1        | `enforce-deactivation-pdf-bullboard`        | B     |
| 14  | make-publish-atomic                | P1        | `make-publish-atomic`                       | B     |
| 15  | transactional-snapshot-restore     | P1        | `transactional-snapshot-restore`            | B     |
| 16  | period-uniqueness-db-constraint    | P1        | `period-uniqueness-db-constraint`           | B     |
| 17  | scope-leadform-getbyperiod         | P1        | `scope-leadform-getbyperiod`                | B     |
| 18  | map-domain-errors                  | P1        | `map-domain-errors`                         | B     |
| 19  | fix-analytics-date-matching        | P1        | `fix-analytics-date-matching`               | C     |
| 20  | fix-reminders-escalation-dedupe    | P1        | `fix-reminders-escalation-dedupe`           | C     |
| 21  | harden-web-vitals-endpoint         | P1        | `harden-web-vitals-endpoint`                | C     |
| 22  | protect-metrics-endpoint           | P1        | `protect-metrics-endpoint`                  | C     |
| 23  | guard-metrics-scrape-db-failure    | P1        | `guard-metrics-scrape-db-failure`           | C     |
| 24  | fix-period-datetime-tz             | P1        | `fix-period-datetime-tz`                    | C     |
| 25  | fix-risk-stage-integrity           | P1        | `fix-risk-stage-integrity-impl`             | C     |
| 26  | key-charts-by-id                   | P1        | `key-charts-by-id`                          | C     |
| 27  | fix-dashboard-nan-pending          | P1        | `fix-dashboard-nan-pending`                 | C     |
| 28  | fix-heap-health-threshold          | P1        | `fix-heap-health-threshold`                 | C     |
| 29  | enforce-smtp-config                | P1        | `enforce-smtp-config`                       | C     |
| 30  | serialize-autosave                 | P1        | `serialize-autosave`                        | C     |
| 31  | observe-prisma-pool                | P1        | `observe-prisma-pool`                       | C     |
| 32  | pin-jwt-algorithms                 | P3        | `input-and-error-hardening` (группа)        | D     |
| 33  | enable-ci-and-pre-push-gates       | P2        | `ci-deploy-supplychain-hardening` (группа)  | D     |
| 34  | lock-supply-chain                  | P2        | `ci-deploy-supplychain-hardening` (группа)  | D     |
| 35  | fix-deploy-seams                   | P2        | `ci-deploy-supplychain-hardening` (группа)  | D     |
| 36  | enforce-csp                        | P2        | `ci-deploy-supplychain-hardening` (группа)  | D     |
| 37  | consolidate-duplicated-derivations | P2        | `code-health-and-test-cleanup` (группа)     | D     |
| 38  | fix-worker-observability           | P2        | `observability-and-perf-hardening` (группа) | D     |
| 39  | fix-dlq-monitoring                 | P2        | `observability-and-perf-hardening` (группа) | D     |
| 40  | shared-dialog-focus-management     | P2        | `code-health-and-test-cleanup` (группа)     | D     |
| 41  | perf-hot-path-queries              | P2        | `observability-and-perf-hardening` (группа) | D     |
| 42  | cleanup-dead-code-and-test-infra   | P2        | `code-health-and-test-cleanup` (группа)     | D     |
| 43  | align-fk-ondelete                  | P2        | `code-health-and-test-cleanup` (группа)     | D     |
| 44  | misc-hardening-and-comment-drift   | P3        | `input-and-error-hardening` (группа)        | D     |

## Backlog findings (56)

| id                         | Приоритет | Заголовок                                                                                     |
| -------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| BL-CARRYOVER-PERSISTENCE   | P0        | Carry-over module silently loses data and crashes on unresolved decisions                     |
| BL-TRUST-PROXY             | P0        | Express trust-proxy never set: rate-limit + audit IP collapse behind Caddy                    |
| BL-PDF-CADDY-404           | P0        | PDF downloads 404 in production: /pdfs not routed to the API at the Caddy edge                |
| BL-WEB-DEV-AUTH-BAKED      | P0        | Prod web image bakes dev auth-stub: login shows dev picker instead of SSO                     |
| BL-ANALYTICS-AUTHZ-LEAK    | P0        | Analytics surface leaks cross-group data to any authenticated user                            |
| BL-REVOKE-BOLA             | P0        | leadForm.revoke / revokeAllSubmitted let a head mutate other groups' sections                 |
| BL-OPEN-REDIRECT           | P0        | Open redirect on login next-param (backslash bypass) and dev-login redirect                   |
| BL-XSS-ORG-INJECTION       | P0        | Stored XSS: org identity injected into a <script> via raw JSON.stringify                      |
| BL-SECTION-OPTIMISTIC-LOCK | P0        | Section save is delete/recreate with no optimistic concurrency: lost updates                  |
| BL-AUTOPUB-ARCHIVED        | P0        | Auto-publisher resurrects an admin-archived period back to published                          |
| BL-DEACTIVATION-BYPASS     | P1        | PDF-export and Bull Board auth paths skip deactivation/revocation checks                      |
| BL-PUBLISH-ATOMICITY       | P1        | Publish is check-then-write (TOCTOU): double-count metrics, stale activeReportId              |
| BL-ANALYTICS-DATE-MATCHING | P1        | Analytics date-equality bugs make Trends comparison/history empty or wrong                    |
| BL-REMINDERS-CORE          | P1        | Escalation digest never fires for late case; email dedupe non-atomic                          |
| BL-ERROR-MAPPING           | P1        | Domain denials thrown as plain Error surface as 500 'Unexpected error'                        |
| BL-SNAPSHOT-RECONCILE      | P1        | Snapshot restore is non-transactional read-modify-write with destructive reconci              |
| BL-PERIOD-CONCURRENCY      | P1        | Period uniqueness invariant is app-level TOCTOU; documented unique index is miss              |
| BL-WEBVITALS-ENDPOINT      | P1        | Web-vitals endpoint: unauth cardinality DoS, no validation 500s, wrong instrumen              |
| BL-METRICS-PUBLIC          | P1        | /metrics is public + unauthenticated at the production edge                                   |
| BL-METRICS-SCRAPE-FAIL     | P1        | DB-backed gauge collect callbacks fail the entire /metrics scrape                             |
| BL-DEADLINE-TZ-DRIFT       | P1        | Period deadline datetime-local parsed as local time -> drift on edit round-trip               |
| BL-RISK-STAGE-INTEGRITY    | P1        | Risk dialog unsaveable with zero stages; stage fields accept empty/null-byte gar              |
| BL-CHART-NAME-COLLISION    | P1        | Charts key series by display name -> duplicate names silently drop one entity's               |
| BL-DASHBOARD-CORRECTNESS   | P1        | Dashboard: NaN submission ring and mislabeled first pending lead                              |
| BL-HEALTH-HEAP-THRESHOLD   | P1        | Heap health threshold 200MB vs 2GB container limit -> false-DOWN flapping                     |
| BL-EMAIL-CONFIG            | P1        | Missing SMTP_HOST silently drops all prod email; EmailService bypasses validated              |
| BL-AUTOSAVE-RACE           | P1        | Lead-form autosave debounce not serialized -> lost-update + unhandled rejection               |
| BL-LEAD-OVERDISCLOSURE     | P1        | leadForm.getByPeriod returns a co-lead's ENTIRE section on any single shared pro              |
| BL-PRISMA-POOL-OBS         | P1        | Idle pg pool errors swallowed; pool size unconfigured                                         |
| BL-DEAD-ROUTERS-AUTH       | P2        | Dead module-level routers and passport-JWT plumbing imply auth paths that don't               |
| BL-DIALOG-A11Y             | P2        | Modal dialogs declare aria-modal but implement no focus trap / restoration                    |
| BL-DUPLICATED-DERIVATIONS  | P2        | Duplicated derivation logic that can silently diverge across modules                          |
| BL-STATUS-WORST-SSOT       | P2        | Worst-status / traffic-light severity logic duplicated (live vs published) _(alreadyTracked)_ |
| BL-WORKER-OBSERVABILITY    | P2        | OTel trace + structured logs break across the BullMQ worker boundary                          |
| BL-DLQ-MONITORING          | P2        | DLQ/queue monitoring gaps: NaN threshold, telegram unmonitored, leaked queues                 |
| BL-ADMIN-LOGS-DROPPED      | P2        | Admin/organization services wire a logger that is a no-op in production                       |
| BL-CI-CD-GATES             | P2        | CI is dormant and not enforceable; local pre-push gate omits typecheck + most CI              |
| BL-SUPPLY-CHAIN            | P2        | Web image skips lockfile integrity; CI/base images not pinned                                 |
| BL-DEPLOY-SEAM-MISC        | P2        | API port mismatch and API host-published bypassing Caddy                                      |
| BL-SECURITY-HEADERS-CSP    | P2        | Production CSP is Report-Only with no report sink -> never enforced                           |
| BL-FK-ONDELETE-ASYMMETRY   | P2        | Project-child FK onDelete inconsistent (Decision/StageStatus CASCADE vs Item/Ris              |
| BL-PERF-QUERIES            | P2        | Queries-in-loop / sequential / per-line filesystem on hot paths                               |
| BL-WEB-CORRECTNESS-MISC    | P2        | Assorted web correctness bugs (dup DOM id, swallowed toast, shared mutation, met              |
| BL-PUBLISH-PARITY-LIVE     | P2        | Live portfolio order nondeterministic; published submission ratio mixes frozen/l              |
| BL-LATENT-CONTRACT-DRIFT   | P2        | Latent contract drift: draft-save drops content, lossy snapshot casts, widening               |
| BL-TEST-INFRA              | P2        | Test infrastructure is dead/misleading (MSW handlers never fire, leaked spies)                |
| BL-SEED-GUARD              | P2        | Seed/backfill scripts missing the non-prod destructive guard                                  |
| BL-DEV-WIPE-ROLE           | P2        | dev.wipeAndReseed gated by protectedProcedure (any role), not adminProcedure                  |
| BL-AUDIT-EVENT-UNION       | P2        | period.manual-edit emitted but absent from the AuditEvent union                               |
| BL-PERIOD-STATE-HYGIENE    | P2        | Scheduled->open flip gated behind autoCreate; auto flags go stale on round-trips              |
| BL-PDF-CHECKSUM-DEAD       | P2        | PDF artifact checksum computed at cost but never persisted (dead contract field)              |
| BL-INPUT-HARDENING         | P3        | Defense-in-depth input hardening (correlation-id, search q null bytes, jwt verif              |
| BL-DEAD-CODE               | P3        | Dead components/modules and dead redirect targets                                             |
| BL-COMMENT-DRIFT           | P3        | Stale/misleading comments and schema bounds vs documented contract                            |
| BL-MINOR-CORRECTNESS-UX    | P3        | Minor UX/correctness nits (confirm dialogs, dead ternary branches, missing memo,              |
| BL-REDUNDANT-WORK          | P3        | Redundant double validation and empty shutdown hook                                           |

**Исключение by design:** BL-STATUS-WORST-SSOT — уже в существующей спеке (traffic-light SSOT), новый change не создавался.
