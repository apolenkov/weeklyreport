# Exemplary MVP review execution

Completed repair checkboxes record verified local corrections. The final verification section remains the release acceptance gate; a local correction does not establish overall readiness. Review observations and baseline test runs are not completion evidence. Close an item only after current-source reconciliation, implementation or evidence-backed disposition, and applicable verification. Detailed accepted evidence is indexed by the retained finding ID outside the repository.

Current execution entry point: section 44. Earlier checked tasks retain their
baseline meaning; they do not establish acceptance of the September 12 branch
snapshot. OpenCode and Codex use this file as the shared execution checklist.
Product-specific quick-edit tasks live only in
[refine-overview-editing-layout](../refine-overview-editing-layout/tasks.md).

Current priority (user correction, 2026-09-12): finish the detailed review and
execution plan before resuming implementation acceptance. Section 46 tracks
planning deliverables; it does not replace section 44 or count as product PASS.
Run diagnostics only to establish a finding, dependency or acceptance method.

Evidence root on this workstation:
`/Users/wrk/.codex/work-artifacts/weeklyreport-quality-plan-2026-09-04/execution/deepseek-session-review-20260912/`.
It contains `branch-review-catalog.json`, `session-requirements.json`,
`quick-edit-findings.json`, `remote-refs.json`, screenshots and CI logs. Raw
evidence stays outside the repository; task status and acceptance live here.

## 1. Shared contracts and acceptance scope

- [x] 1.1 Complete substantive review of all 2,466 snapshot files and retain source identities and per-file criteria outside the repository.
- [x] 1.2 Port all 231 accepted in-scope finding IDs into this task list exactly once, grouped by owning work area.
- [x] 1.3 Review all relevant source changes since the snapshot and reconcile neighboring authoring and feedback work without overwriting it.
- [x] 1.4 Trace shared contract changes before updating API and web consumers; preserve period dual-state and canonical procedure builders.
- [x] 1.5 Complete the system-level architecture assessment and declare the final critical desktop scenario matrix, preserving the full agreed goal.

## 2. R1 seed fixtures and rationale

Existing contract entry points to confirm: [demo-seed-datasets](../../specs/demo-seed-datasets/spec.md), [seed-determinism](../../specs/seed-determinism/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 2.1 `R1-contracts-data-3-F001` — Clarify the comment and onboarding/seed contract to distinguish migrate-reset Wipe + Reseed from direct idempotent seed. Add a mock-upsert test documenting the chosen state-preserving or state-resetting behavior; do not change provider state as part of this review.
- [x] 2.2 `ROOT-R1-ADVANCED-SEED-COMMENTS-001` — Describe the currently supported ranges, risk-derived color, relative dates, actual upsert identity policy, and explicit summary count denominator; remove chronology. Do not change runtime behavior merely to match stale comments.
- [x] 2.3 `ROOT-R1-DOC-001` — Replace mechanical comments with short current-purpose JSDoc. Consolidate truly identical schema factory declarations in ai-prompt-management.ts after checking callers.
- [x] 2.4 `ROOT-R1-DOC-002` — Replace inaccurate prose with current rationale, keep import declarations contiguous, remove redundant separators. Preserve historical published read semantics.
- [x] 2.5 `ROOT-R1-MAPPER-COMMENT-001` — State that shared context retains the section risk set and the derivation helper owns product filtering. Remove the unsupported claim that all pre-filtering changes results.
- [x] 2.6 `ROOT-R1-PATH-001` — Pass concrete field paths into uniqueness checks, keeping normalization and rejection semantics.
- [x] 2.7 `ROOT-R1-PERF-001` — Use one locally owned Map with in-place set while preserving first-index diagnostics; inspect existing lint local-mutation policy and same pattern in reminder grouping before implementation.
- [x] 2.8 `ROOT-R1-REPORT-PERF-001` — Use single local maps keyed by record type and relevant identity, preserving the first duplicate location and message paths.
- [x] 2.9 `ROOT-R1-SEED-DATE-001` — Share UTC period-date helpers across simple/full seed profiles, preserve IDs, week labels, and `deadline15UTC`, and use an inclusive millisecond end.
- [x] 2.10 `ROOT-R1-SEED-DOC-001` — Correct concise current rationale, remove proof claims and stale compiler limitation; preserve deterministic data identities. Reuse canonical role/email type/constants if consumer boundaries support it, without adding adapters.
- [x] 2.11 `ROOT-R1-SEED-JOURNEY-EDITABLE-001` — Check the canonical editable section lifecycle and record ownership/schema requirements for the promised minimal journey, or narrow the assertion wording if existence alone is intended. Keep existing ROOT-R1-SEED-STAGE-001 ownership fix linked.
- [x] 2.12 `ROOT-R1-SEED-PRIORITY-ORDER-001` — Assert clearing settles before any rank update, preferably through an explicit event sequence or delayed clear promise; keep the production dependency unchanged unless another concrete reason supports narrowing it.
- [x] 2.13 `ROOT-R1-SEED-REF-001` — Validate the explicit instant with its timezone before parsing, using existing schema conventions; preserve the documented unset-as-current-time convenience. Remove the unnecessary `process.env` assertion.
- [x] 2.14 `ROOT-R1-SEED-SIMPLE-001` — Reuse the canonical provisional builder, compute snapshot JSON once, preserve the inferred stress-kind union, and remove the unfulfilled type-negative claim or add an actual assertion.
- [x] 2.15 `ROOT-R1-SEED-STAGE-001` — Align the valid demo fixture with existing stage assignments and preserve the ordinary author happy-path save. Do not add ownership or admission policy behavior.
- [x] 2.16 `ROOT-R1-SIMPLE-002` — Reuse one rectangle schema, remove unused internal ownership field, remove redundant fixture overrides. Coordinate active Agentation delta before edits.
- [x] 2.17 `ROOT-R1-TEST-001` — Start each negative scenario from a successful valid baseline, mutate one target property, assert target issue path where contractual. Preserve separate unknown-field tests.
- [x] 2.18 `ROOT-R1-TEST-002` — Remove self-confirming assertion; derive negatives from valid baselines and isolate named failure. Correct misleading titles or inputs.
- [x] 2.19 `ROOT-R1-TIMEZONE-001` — Reuse valid timezone validation compatible with deadline calculation in full and partial settings contracts. Preserve required persisted fields and absence semantics.

## 3. R2 PDF export lifecycle and proof

Existing contract entry points to confirm: [pdf-export-integrity](../../specs/pdf-export-integrity/spec.md), [queue-worker-architecture](../../specs/queue-worker-architecture/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 3.1 `ROOT-R2-PDF-DOWNLOAD-ABORT-001` — Tie readable-stream destruction and descriptor release to response close, or use appropriate pipeline cleanup, while retaining existing before/after-header error behavior. Add a meaningful client-abort case with a real stream.
- [x] 3.2 `ROOT-R2-PDF-TEST-CURRENT-CONTRACT-001` — Align file/suite names and comments with actual report-read, queue-identity and no-op collaborator contracts; retain immutable requester-only artifact access.
- [x] 3.3 `ROOT-R2-PDF-TEST-PROOF-001` — Assert the actual PDF job payload and configured cookie-name fixture wiring. Omit token-expiry mutation and group-revocation/access test work from this queue.
- [x] 3.4 `ROOT-R2-PDF-TEST-RESOURCE-001` — Own all fixture files beneath a per-test temporary root; close the opened file descriptor in mocked read-error paths, or inject failures without dropping descriptor ownership; restore touched environment values.

## 4. R2 period scheduling and contract

Existing contract entry points to confirm: [admin-settings-ui](../../specs/admin-settings-ui/spec.md), [period-scheduler-wiring](../../specs/period-scheduler-wiring/spec.md), [period-dual-state](../../specs/period-dual-state/spec.md), [manual-publish-telemetry](../../specs/manual-publish-telemetry/spec.md).

- [x] 4.1 `R2-api-domain-4-F001` — Update the historical whole-hour/fixed-18:00 statement to the current configured HH:MM behavior shared by the factory and scheduler. Do not revert tested minute precision merely to satisfy stale current-behavior prose.
- [x] 4.2 `ROOT-R2-PERIOD-CRON-TZ-001` — Pin creator and archive decorators to UTC to honor existing source intent; record UTC schedule in scheduler spec when implementing the change.
- [x] 4.3 `ROOT-R2-PERIOD-TEST-ERROR-NAME-001` — Assert `PeriodNotFoundError` and describe the intended mapping.
- [x] 4.4 `ROOT-R2-SCHEDULER-MOCK-TYPING-001` — Type fixture members against used constructor/dependency public method signatures before necessary class-seam cast; remove false assurance.

## 5. R2 published-lineage write race

Existing contract entry points to confirm: [publish-compare-and-set](../../specs/publish-compare-and-set/spec.md), [reopen-compare-and-set](../../specs/reopen-compare-and-set/spec.md), [fill-from-write-lock](../../specs/fill-from-write-lock/spec.md), [record-comment-save-coordination](../../specs/record-comment-save-coordination/spec.md).

- [x] 5.1 `ROOT-R2-FILL-PUBLISH-REOPEN-LINEAGE-001` — Recheck target published lineage inside transaction after parent Report lock and before version bump/deletes. Preserve direct reopened fill for targets with no published item/decision lineage.
- [x] 5.2 `ROOT-R2-SAVE-PUBLISH-REOPEN-LINEAGE-001` — Consolidate with Fill From record-preservation repair. Recheck current published item/decision identities against final save payload inside the report/section transaction before child deletion; keep draft additions deletable until published.

## 6. R2 reminders and lead-form transitions

Existing contract entry points to confirm: [reliable-reminder-delivery](../../specs/reliable-reminder-delivery/spec.md), [reminder-policy-timezone-validation](../../specs/reminder-policy-timezone-validation/spec.md), [lead-form-write-actions](../../specs/lead-form-write-actions/spec.md), [reopen-compare-and-set](../../specs/reopen-compare-and-set/spec.md), [observability-metrics-coverage](../../specs/observability-metrics-coverage/spec.md).

- [x] 6.1 `ROOT-R2-LEAD-REOPEN-METRIC-TEST-001` — Inject spy telemetry and assert recordReopenRequest is untouched on denied command, or use explicit real metric adapter.
- [x] 6.2 `ROOT-R2-REMINDER-CYCLE-SQL-TZ-001` — Compare the UTC date of the stored timestamp without introducing a session-dependent `timestamptz` conversion, keeping the current timestamp-storage contract explicit. Add non-UTC session-boundary cases to the guarded integration suite.
- [x] 6.3 `ROOT-R2-REMINDER-DISPATCH-FALSE-SUCCESS-001` — Represent enqueue failure explicitly across service/scope result, retain per-recipient continuation and persisted failed state, update shared/router aggregate and dashboard failure presentation. Preserve successful recipients in mixed batches; distinguish queued from sent in UI copy.
- [x] 6.4 `ROOT-R2-REMINDER-LEAD-COMMENTS-001` — Remove stale/exclusive/positional claims and state the currently exercised behavior.

## 7. R2 report-section lineage, writes, and evidence

Existing contract entry points to confirm: [period-dual-state](../../specs/period-dual-state/spec.md), [report-section-write-gates](../../specs/report-section-write-gates/spec.md), [report-section-prisma-payload](../../specs/report-section-prisma-payload/spec.md), [published-portfolio-snapshot](../../specs/published-portfolio-snapshot/spec.md), [record-comment-save-coordination](../../specs/record-comment-save-coordination/spec.md), [record-status-derivation](../../specs/record-status-derivation/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 7.1 `R2-api-domain-1-F001` — Share idempotent drain and terminal exit coordination between fatal and signal handlers, preserving fatal failure exit semantics even when signal arrives first.
- [x] 7.2 `R2-api-domain-2-F001` — Make the existing ensureCurrentPeriod/login repair path part of the explicit acceptance contract and add a bounded retry/repair trigger for periods that are not reached by current-period access; avoid claiming permanent loss without runtime evidence.
- [x] 7.3 `R2-api-domain-2-F002` — Record the product decision. If full history is required, add a reopen-specific cursor/limit and nextCursor contract and UI paging; if the newest-100 cap is intentional, document it in the reopen-requests product/spec contract and accept the limitation.
- [x] 7.4 `ROOT-R2-ARCHIVED-DRAFT-LINEAGE-001` — Admit only reports that actually reached publication, while retaining integrity refusal for corrupt genuine publications. Do not fix by silently skipping all null snapshots. Preserve reopened and archived-published lineage.
- [x] 7.5 `ROOT-R2-BATCH8-COMMENT-ACCURACY-001` — Rewrite only inaccurate labels/rationale around current source behavior; keep useful concurrency/identity explanations and drop historical architecture labels. No security behavior or rights policy changes.
- [x] 7.6 `ROOT-R2-BATCH8-TEST-PROOF-BOUNDARIES-001` — Compare original and reloaded identity sets; remove dead history callbacks and rename fixed-source tests; provide complete canonical publication/archive tuples and assert intended functional error.
- [x] 7.7 `ROOT-R2-BOOT-CLEAN-001` — Correct current rationale, remove vacuous assertion and redundant data copy. Simplify shutdown wrapper when integrating shared coordinator, without introducing compatibility adapters.
- [x] 7.8 `ROOT-R2-CARRY-COMMENTS-001` — Correct or remove obsolete rationale while fixing corresponding implementations; keep comments about real lineage, XOR and transaction constraints.
- [x] 7.9 `ROOT-R2-CARRY-REPLAY-001` — Resolve replay from locked current persisted sections before merging a fresh plan. Add returned-content assertion with winner/loser decision identities; align decision merge dedupe with durable lineage.
- [x] 7.10 `ROOT-R2-CARRY-VERSION-001` — Advance the section version atomically when carried content changes, return the correct updated section; replay/no-op must not create fictitious changes. Preserve lock order and matched-author scope.
- [x] 7.11 `ROOT-R2-CLIENT-BODY-001` — Admit body as unknown and safely handle absent/nonobject input consistent with bounded-ingress contract, then parse entries. Preserve limits and disabled fast-path.
- [x] 7.12 `ROOT-R2-CURRENT-COMMENTS-001` — Update rationale to match current inputs, bucket mapping and possible retained revocation after unsuccessful removal. Any behavior change needs its own contract decision.
- [x] 7.13 `ROOT-R2-DELETE-COPY-001` — Correct English error message to describe allowed draft-open-unarchived deletion; preserve gate.
- [x] 7.14 `ROOT-R2-ESCALATION-ACCUMULATION-001` — Use local result array and seen Set with explicit iteration while preserving the pure external interface, first contributor and blocked→flagged-red→unresolved ordering.
- [x] 7.15 `ROOT-R2-FILL-PAUSED-REASON-001` — Add pausedReason to SourceItem and copied payload; correct reasonless paused fixture and assert preserved reason.
- [x] 7.16 `ROOT-R2-FIXTURE-STATE-001` — Make valid fixtures carry the full canonical/companion tuple; preserve deliberate invalid cases. Make replay fixtures reflect actual stored content.
- [x] 7.17 `ROOT-R2-INTERVAL-COMMENTS-001` — Call the existing predicate for closed-interval overlap; preserve behavior.
- [x] 7.18 `ROOT-R2-OVERVIEW-PAUSED-REDACTION-001` — Represent redacted section/item read contract explicitly and use it at overview/shared-lens boundaries, retaining strict reason validation for author writes. Do not restore secret reason or disable output validation.
- [x] 7.19 `ROOT-R2-PERIOD-PUBLICATION-RATIONALE-001` — Correct/remove stale rationale and test labels; make auto-publish skip log neutral to actual CAS reason. Keep established lifecycle behavior and avoid expanding test claims.
- [x] 7.20 `ROOT-R2-PREWRITE-SUCCESS-001` — Move completed-action logs after successful repository resolution, or use explicit attempt wording before writes. Preserve error propagation and audit ownership.
- [x] 7.21 `ROOT-R2-PUBLICATION-METRIC-TEST-001` — Inject spy telemetry into skip case and assert both callbacks untouched, or inject real adapter and retain independent counter deltas.
- [x] 7.22 `ROOT-R2-READ-SIMPLIFY-001` — Remove redundant projection filter, narrow archive select to consumed fields, and use map for one-to-one summaries. Keep published floor, frozen ACL and parsing.
- [x] 7.23 `ROOT-R2-RESTORE-COLLECTIONS-001` — Use locally owned Maps with in-place group accumulation; preserve order, policy pair exclusion and latest-rule selection. Same copy pattern was confirmed separately in shared snapshot integrity.
- [x] 7.24 `ROOT-R2-REVIEW-STATUS-PORT-001` — Remove currentStatus from repository port input and service call; pass the locked current section status explicitly to the private transition helper. Update fake/result expectations to model port outcomes directly.
- [x] 7.25 `ROOT-R2-SECTION-COMMENT-ACCURACY-001` — Narrow comments/titles to observed behavior, remove historical line-budget rationale, and retain meaningful activity edit recency: parent updatedAt already covers activity-only save.
- [x] 7.26 `ROOT-R2-SECTION-EXPORT-ORDER-001` — Sort and consolidate named re-exports using existing formatter/linter rules, preserving public identities.
- [x] 7.27 `ROOT-R2-SECTION-NOTFOUND-500-001` — Throw existing typed NotFound error and strengthen missing-row contract assertion to cover mapped code.
- [x] 7.28 `ROOT-R2-SECTION-TEST-PROOF-BOUNDARIES-001` — Start null-clear test from non-null; supply valid published tuple to lock test; rename pure frozen projections accurately; remove duplicate risk rows or vary a real boundary.
- [x] 7.29 `ROOT-R2-SECTION-WRITE-FIXTURE-COPIES-001` — Reuse baseSection.items and multiProjectSection.items directly; remove no-op mappings and false stage guarantee comments.
- [x] 7.30 `ROOT-R2-SNAPSHOT-FIXTURE-DUPLICATION-001` — Share the small local section fixture and remove repeated equivalent cases or give them a genuinely distinct serialization/input boundary. Keep risk-floor/product-isolation coverage.
- [x] 7.31 `ROOT-R2-SNAPSHOT-LOG-001` — Move success log after successful awaited persistence.
- [x] 7.32 `ROOT-R2-FROZEN-REFERENCE-PROJECTION-001` — Preserve referenced-only product records in frozen by-product and print projections without inventing editable ownership or health contributions.

## 8. R2 repository gate analysis

Existing contract entry points to confirm: [role-coverage-gate](../../specs/role-coverage-gate/spec.md), [report-section-write-gates](../../specs/report-section-write-gates/spec.md), [ci-merge-gate](../../specs/ci-merge-gate/spec.md), [repository-scope-guard](../../specs/repository-scope-guard/spec.md).

- [x] 8.1 `ROOT-R2-LIFECYCLE-GATE-BYPASS-001` — Resolve bound writer aliases and root spreads with order-aware provenance, or reject unresolved write-bearing forms; add planted negatives.

## 9. R2 weekly report transaction and evidence

Existing contract entry points to confirm: [activity-reporting-unit](../../specs/activity-reporting-unit/spec.md), [archive-published-floor](../../specs/archive-published-floor/spec.md), [record-status-derivation](../../specs/record-status-derivation/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md), [operations-local-readiness](../../specs/operations-local-readiness/spec.md).

- [x] 9.1 `ROOT-R2-BATCH9-COMMENT-ACCURACY-001` — Correct the rationale and names to match current sources, and remove historical labels. Preserve valid single-owner/stage-assignment contracts; do not reinterpret ownership policy or expand scope.
- [x] 9.2 `ROOT-R2-BATCH9-TEST-PROOF-BOUNDARIES-001` — Collapse duplicated null-query case; narrow labels to actual forwarding/query/AST/orchestration evidence; use canonical published fixture tuple. Add persisted readback only if lifecycle nonmutation remains the stated integration test contract.
- [x] 9.3 `ROOT-R2-MAILPIT-POLL-DEADLINE-001` — Bound each polling GET and its body consumption by remaining total deadline, return null on the polling deadline, and cap sleep to remaining time. Keep standalone list/clear behavior separate.
- [x] 9.4 `ROOT-R2-WEEKLY-TRANSACTION-TEST-FALLBACK-001` — Remove the test-only production branch and supply an interactive-transaction callback in relevant unit doubles. Retain RepeatableRead and existing read sequence.

## 10. R3 AI provider and prompt fixtures

Existing contract entry points to confirm: [ai-prompt-management](../../specs/ai-prompt-management/spec.md), [ai-provider-configuration](../../specs/ai-provider-configuration/spec.md), [ai-provider-admin-layout](../../specs/ai-provider-admin-layout/spec.md), [lead-assistant-provider-resilience](../../specs/lead-assistant-provider-resilience/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 10.1 `ROOT-R3-PROMPT-DRAFT-FIXTURE-001` — Return fully typed control including history; provide distinct created draft with draft lifecycle and ID, assert returned draft and expected base input.
- [x] 10.2 `ROOT-R3-PROMPT-GOLDEN-TITLE-001` — Rename test to timezone envelope behavior actually asserted; do not claim cross-language model coverage.
- [x] 10.3 `ROOT-R3-PROVIDER-RESTORE-EVENT-001` — Emit restored only within successful activation path after repository reports success. Preserve failed-preparation return contract and old active pointer. Add focused failed and successful restore assertions; do not infer success from merely returned readback pointer due concurrent changes.
- [x] 10.4 `ROOT-R3-RUNTIME-PROVIDER-FIXTURE-001` — Use complete typed current provider-select fixture, remove unused source-generation stub and duplicate equivalent test/harness setup after checking intended source-read availability requirement. Keep snapshot pairing/serving contract/composition cases.

## 11. R3 API infrastructure, routers, and fixtures

Existing contract entry points to confirm: [role-coverage-gate](../../specs/role-coverage-gate/spec.md), [audit-target-coverage](../../specs/audit-target-coverage/spec.md), [observability-metrics-coverage](../../specs/observability-metrics-coverage/spec.md), [api-health-indicators](../../specs/api-health-indicators/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 11.1 `ROOT-R3-CITATION-BUNDLE-FIXTURE-001` — Replace with complete typed GroundingBundle fixture containing valid small item/risk records; no production validator change.
- [x] 11.2 `ROOT-R3-CONFIG-COMMENTS-001` — Describe current no-send dev behavior, correct probe count and state actual CORS allowlist rationale. No transport policy change implied.
- [x] 11.3 `ROOT-R3-INFRA-CURRENT-RATIONALE-001` — Remove outdated comments or state present configuration/fixture behavior only. No policy changes.
- [x] 11.4 `ROOT-R3-OPTIONAL-ROUTER-SERVICE-CONTRACT-001` — Require subrouter services consistently with root; ordinary fixtures use shared dependency builder. Keep intentional missing-wiring rejection semantics where directly tested (ops/telemetry).
- [x] 11.5 `ROOT-R3-PDF-STARTUP-001` — Catch/log failure at startup async boundary and preserve scheduled retry. Do not suppress all unhandled rejections globally.
- [x] 11.6 `ROOT-R3-PDF-TEST-001` — Assert actual terminal method not called, correct typed seams, assert claim resolves before send in named ordering case.
- [x] 11.7 `ROOT-R3-PERIOD-SOURCE-COMMENT-001` — Describe one canonical source per report before section authorization, remove incorrect immutable adjective.
- [x] 11.8 `ROOT-R3-QUEUE-COMMENTS-001` — Correct stale ownership/ambiguity comments and titles without silently altering delivery retry policy.
- [x] 11.9 `ROOT-R3-ROUTER-CURRENT-RATIONALE-001` — Update or remove stale rationale/test wording based on current code and canonical specs; do not change access-control behavior or evaluate security guarantees.
- [x] 11.10 `ROOT-R3-ROUTER-DOMAIN-MAPPER-DUPLICATION-001` — Replace only mechanically equivalent catches with existing helper; preserve callback sequencing, schemas, middleware identity and specialized logging.
- [x] 11.11 `ROOT-R3-TEST-ENV-RESTORATION-001` — Use vi.stubEnv for the four assignments and vi.unstubAllEnvs in afterEach, preserving original values and absence. Do not change scenario inputs/expectations or production auth code.

## 12. R3 feedback and auth general code quality

Existing contract entry points to confirm: [authenticated-product-feedback](../../specs/authenticated-product-feedback/spec.md), [auth-module-layering](../../specs/auth-module-layering/spec.md), [saml-provisioning](../../specs/saml-provisioning/spec.md), [structured-user-name](../../specs/structured-user-name/spec.md), [user-name-display](../../specs/user-name-display/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 12.1 `ROOT-R3-AGENTATION-ROW-FIXTURE-001` — Reuse one complete typed Agentation inbox row fixture in these tests; remove obsolete fields and whole-row assertion. Preserve immutable-author expectation with distinct relevant values; reconcile active neighboring feedback edits first.
- [x] 12.2 `ROOT-R3-AUTH-COMMENT-ACCURACY-001` — Change comments only to actual normalized relative-path handoff and explicit recency ordering fixture intent. Do not change auth/redirect/security behavior or add security tests.

## 13. R3 router fixture consolidation

Existing contract entry points to confirm: [role-coverage-gate](../../specs/role-coverage-gate/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 13.1 `ROOT-R3-INFRA-TEST-FIXTURE-REUSE-001` — Use createStubAppRouterDeps({leadFormService}) and {...createNullAuditLogger(),mutation}; preserve all scenario inputs/expectations and active service pipeline.
- [x] 13.2 `ROOT-R3-ROUTER-TEST-FIXTURE-CONSOLIDATION-001` — Use existing builders for ordinary cases and small local typed fixtures where needed; retain deliberate malformed-wiring/input cases. Validate service stub members with Pick/satisfies where natural, since existing root override builder only validates keys.

## 14. R3 runtime utility structure

Existing contract entry points to confirm: [operational-logger-wiring](../../specs/operational-logger-wiring/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 14.1 `ROOT-R3-BUSINESS-DAY-EAGER-WORK-001` — Use bounded offset loop with early return after nth working day. Compute each candidate from original dt+offset, not previous candidate, preserving wall-clock behavior after DST gaps. Preserve zero/backward/iteration-budget semantics and validate invalid n deliberately.
- [x] 14.2 `ROOT-R3-LOGGER-SINK-FACADE-001` — Call this.fileSink.enqueue(entry), remove helper/import and stale wrapper rationale, describe actual sink failure/flush contract if comment needed. Preserve catch/queue/flush implementation.

## 15. R3 search accumulation and fixtures

Existing contract entry points to confirm: [search-contract-precision](../../specs/search-contract-precision/spec.md), [semantic-embedding-cache](../../specs/semantic-embedding-cache/spec.md), [viewer-published-search](../../specs/viewer-published-search/spec.md), [lead-report-assistant](../../specs/lead-report-assistant/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 15.1 `ROOT-R3-SEARCH-ACCUMULATOR-COPY-001` — Use local Map accumulators and arrays with preserved first-seen order; keep alias normalization, kind+ID identity, alias dedup, original label precedence and final lexical aggregate ordering. Do not change token/access resolution.
- [x] 15.2 `ROOT-R3-SEMANTIC-GROUP-COPY-001` — Build one local Map with mutable local candidate arrays; preserve first hash insertion order and candidate order, expose readonly return. Do not change cache/ranking/provider policy.
- [x] 15.3 `ROOT-R3-UNUSED-SELF-TEST-FAKES-001` — Delete unused self-test file after current-source reference check; preserve real model/embedding adapter and assistant tests.

## 16. Cross-surface pending-draft success policy

Existing contract entry points to confirm: [lead-form-draft-merges](../../specs/lead-form-draft-merges/spec.md), [lead-form-draft-module](../../specs/lead-form-draft-module/spec.md), [lead-form-draft-orchestration](../../specs/lead-form-draft-orchestration/spec.md), [lead-form-write-actions](../../specs/lead-form-write-actions/spec.md), [admin-entity-write-integrity](../../specs/admin-entity-write-integrity/spec.md).

- [x] 16.1 `ROOT-R5-ADMIN-PENDING-DRAFT-LOSS-001` — Disable draft fields during pending save or preserve newer revision when earlier save succeeds; apply coherent policy to related admin forms after tracing callers.
- [x] 16.2 `ROOT-R5-REOPEN-PENDING-DRAFT-LOSS-001` — Prevent cross-row response switches and pending note edits or key success cleanup to submitted request/draft revision; apply coherent shared ReopenRespondForm policy.
- [x] 16.3 `ROOT-R5-SETTINGS-PENDING-DRAFT-LOSS-001` — Preserve edits by revision-aware success or consistently disable edits while save pending; never use reset to treat an in-flight request as cancelled.

## 17. R4 async generation write lifecycle

Existing contract entry points to confirm: [lead-form-draft-orchestration](../../specs/lead-form-draft-orchestration/spec.md), [lead-form-draft-merges](../../specs/lead-form-draft-merges/spec.md), [lead-form-draft-module](../../specs/lead-form-draft-module/spec.md), [lead-form-data-loading](../../specs/lead-form-data-loading/spec.md).

- [x] 17.1 `ROOT-R4-AUTOSAVE-CROSS-SECTION-VERSION-001` — Scope version updates and queue drain to current section/generation, preserving valid same-section response handling and queued edits.
- [x] 17.2 `ROOT-R4-DRAFT-SUBMIT-GENERATION-001` — Scope async submit continuation to its originating section/generation; ignore obsolete state updates and integrate with autosave generation correction.

## 18. R4 formatter and export cleanup

Existing contract entry points to confirm: [ci-merge-gate](../../specs/ci-merge-gate/spec.md), [repository-file-accountability](../../specs/repository-file-accountability/spec.md).

- [x] 18.1 `ROOT-R4-BATCH3-BASELINE-FORMATTING-001` — Apply repository formatter and export ordering to exact changed files while preserving current planned-current semantics.
- [x] 18.2 `ROOT-R4-BATCH4-FORMAT-001` — Apply project formatter to helper preserving planned-current neighbor semantics.
- [x] 18.3 `ROOT-R4-BATCH5-FORMAT-001` — Apply repository formatter.
- [x] 18.4 `ROOT-R4-BATCH6-FORMAT-001` — Apply repository formatter.

## 19. R4 item/status UI and fixtures

Existing contract entry points to confirm: [lead-item-card-uniformity](../../specs/lead-item-card-uniformity/spec.md), [record-dialog-layout](../../specs/record-dialog-layout/spec.md), [record-status-derivation](../../specs/record-status-derivation/spec.md), [status-risk-unification](../../specs/status-risk-unification/spec.md), [risk-stage-integrity](../../specs/risk-stage-integrity/spec.md), [lead-form-cross-author-scope](../../specs/lead-form-cross-author-scope/spec.md).

- [x] 19.1 `ROOT-R4-BATCH6-CURRENT-RATIONALE-001` — Replace history/false guarantees with terse current behavior; do not change active lifecycle or UX on basis of stale comments.
- [x] 19.2 `ROOT-R4-BOARD-DEAD-STAGE-MODE-001` — Require products on both component contracts and helper; remove unreachable grouping branch and stage-key helpers, update fixtures.
- [x] 19.3 `ROOT-R4-BOARD-WRAPPER-DUPLICATION-001` — Render BoardGrid directly from both week hosts and reuse BoardEmptyState with next-week labels; remove wrappers and duplicated types.
- [x] 19.4 `ROOT-R4-ITEM-DIALOG-TEST-EVIDENCE-001` — Update vocabulary to active contract. Make save scenario valid and reopen with emitted payload, or name it prop-reseed-only. Narrow layout claims to CSS contract; retain real browser geometry acceptance.
- [x] 19.5 `ROOT-R4-PORTFOLIO-DECISION-EMPTY-001` — Add content-presence signal matching detailed product content and use it for emptiness/navigation. Preserve count labels unless expanded copy is required. Include priorities/attention according to existing reportHasContent contract.
- [x] 19.6 `ROOT-R4-STAGE-REQUIRED-DEAD-PROP-001` — Remove dead prop and redundant required-mode tests; preserve explicit stage-required validation in parent form.

## 20. R4 lead report loading and fixtures

Existing contract entry points to confirm: [lead-form-data-loading](../../specs/lead-form-data-loading/spec.md), [lead-form-loaded-view-model](../../specs/lead-form-loaded-view-model/spec.md), [loading-layout-stability](../../specs/loading-layout-stability/spec.md), [web-trpc-test-harness](../../specs/web-trpc-test-harness/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 20.1 `R4-report-ui-1-F003` — Use useMutation(trpc.leadForm.assistant.mutationOptions()) directly and remove the optional procedure cast, fallback and now-unused aliases. Repair partial test mocks if required; no additional adapter.
- [x] 20.2 `ROOT-R4-ACTIVITY-ADD-GATE-001` — Base general add availability on valid product/activity parents, preserving specific blocker prefill rules. Pass required activity availability into presentation and accordion gates; retain readOnly guards.
- [x] 20.3 `ROOT-R4-BATCH2-CURRENT-RATIONALE-001` — Replace inaccurate/historical wording with current preconditions and narrowly stated test/layout evidence. Preserve useful generation, cache, dirty-draft and request-id explanations.
- [x] 20.4 `ROOT-R4-BATCH2-TEST-EVIDENCE-001` — Rename type assertion to its actual subset guarantee; add positive loading-status/skeleton assertion to report-key transition test. Avoid implementation-mirroring new tests or generic selector rewrites.
- [x] 20.5 `ROOT-R4-BATCH3-CURRENT-RATIONALE-001` — Describe current behavior and literal evidence, remove historical/incomplete claims, preserve useful queue identity and lifecycle rationale.
- [x] 20.6 `ROOT-R4-BATCH3-REDUNDANT-SEAMS-001` — Use required model activities field and valid fixtures; inline identity accessor; remove unused invalidate dependency/invocation while leaving real adapter invalidation.
- [x] 20.7 `ROOT-R4-BATCH3-TEST-EVIDENCE-001` — Use an actual empty submitted row, named alertdialog confirmation control, covering risk in planned test, P3 update with exact P2 drain assertion, and exact one save with timer advance.
- [x] 20.8 `ROOT-R4-BATCH8-TEST-RATIONALE-001` — Narrow claims to actual behavior, use real supported inputs/shared fixtures; retain meaningful defensive index checks.
- [x] 20.9 `ROOT-R4-BATCH9-RATIONALE-001` — Rename pure handler factories, correct present rationale and narrow test claims; retain accessibility browser followups.
- [x] 20.10 `ROOT-R4-CHROME-RATIONALE-001` — Correct these short comments to current typing, one-way derivation, risk prefill and asynchronous observer timing.
- [x] 20.11 `ROOT-R4-DEAD-CARD-TEXT-EDITOR-001` — Remove text-only component, unused ItemCard props/branch, corresponding style edit-height branch and test. Keep active full editor and its tests.
- [x] 20.12 `ROOT-R4-DEAD-PRESENTATION-STATE-001` — Delete unused editing-hook state/import/return fields and misleading comment. Remove unconsumed header token fields while preserving avatar/status colors and actual loaded expansion behavior.
- [x] 20.13 `ROOT-R4-LEAD-TEST-FIXTURE-DUPLICATION-001` — Use shared typed report-section defaults and a small provider/query harness with explicit per-case overrides. Keep vi.mock declarations local and fake-timer cadence isolated. Consolidate identical cases while retaining distinct query, mutation, generation and timing boundaries; simplify weekly fixture types from shared models.
- [x] 20.14 `ROOT-R4-NOOP-TITLE-EFFECT-001` — Remove unused effect and import.
- [x] 20.15 `ROOT-R4-PARENT-STALE-VALIDATION-001` — Invalidate parent-dependent validation errors when parent changes in both shared form hooks.
- [x] 20.16 `ROOT-R4-PRODUCT-SCOPE-PROVENANCE-001` — Aggregate product identities across sections including referenced metadata; register activity contribution; unify synthetic Shared identity.
- [x] 20.17 `ROOT-R4-READONLY-SUBMIT-TEST-001` — Use current accessible Submit name and assert no Submit controls across the read-only form; verify mutation inserting a Submit button makes the test fail.
- [x] 20.18 `ROOT-R4-SUBMIT-REDUNDANT-STATUS-SCAN-001` — Reuse existing promotion list for the two equivalent result fields, retaining public shape only if both consumed.
- [x] 20.19 `ROOT-R4-SUPPORTING-READ-TERMINAL-STATE-001` — Define one required-read outcome including loading, error with retry and no-active/section-unavailable. Propagate active/history errors to persistent recovery UI and retry the failed required query. Preserve no fabricated active-from-draft and generation matching. Add corresponding OpenSpec scenarios before implementation.

## 21. R4 lead write and draft lifecycle

Existing contract entry points to confirm: [lead-form-draft-module](../../specs/lead-form-draft-module/spec.md), [lead-form-draft-orchestration](../../specs/lead-form-draft-orchestration/spec.md), [lead-form-write-actions](../../specs/lead-form-write-actions/spec.md), [lead-form-draft-merges](../../specs/lead-form-draft-merges/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 21.1 `ROOT-R4-AUTOSAVE-HARNESS-CONTRACT-001` — Return valid shared section fixtures with explicit version overrides from typed save callback, remove obsolete tRPC save stub after exact caller check, and consolidate duplicate lifecycle cases without deleting timing/conflict/queue distinctions.
- [x] 21.2 `ROOT-R4-BATCH4-CURRENT-RATIONALE-001` — Remove stale claims and history; describe current caller and data behavior. Rename obsolete test descriptions and consolidate identical planned-next case.
- [x] 21.3 `ROOT-R4-BATCH4-TEST-EVIDENCE-001` — Consolidate duplicate; add distinctive unaffected row assertion only where guarantee matters; narrow overstated title; assert representative expected query keys.
- [x] 21.4 `ROOT-R4-DRAFT-TEST-TRANSPORT-RESIDUE-001` — Remove unused transport wrapper and mock setup from these two in-memory draft tests.

## 22. R4 report-section projections

Existing contract entry points to confirm: [activity-reporting-unit](../../specs/activity-reporting-unit/spec.md), [lead-form-cross-author-scope](../../specs/lead-form-cross-author-scope/spec.md), [report-card-clarity](../../specs/report-card-clarity/spec.md), [lead-surface-name-resolution](../../specs/lead-surface-name-resolution/spec.md), [status-presentation-model](../../specs/status-presentation-model/spec.md), [record-status-derivation](../../specs/record-status-derivation/spec.md), [lead-completion-guidance](../../specs/lead-completion-guidance/spec.md).

- [x] 22.1 `ROOT-R4-BATCH5-CURRENT-RATIONALE-001` — Replace with concise current rationale and exact case names. Preserve active behavior/exports.
- [x] 22.2 `ROOT-R4-BATCH5-FIXTURE-EVIDENCE-001` — Apply defaults before overrides, make incomplete risk fixture exercise exclusion, supply complete typed weekly fixtures.
- [x] 22.3 `ROOT-R4-BY-LEAD-REFERENCED-CONTENT-001` — Include required readonly referenced project cards and names in by-lead projection; preserve no-stray-editable-card rule on lead form. Clarify status projection in OpenSpec change.
- [x] 22.4 `ROOT-R4-PARENT-MODEL-UI-TYPES-001` — Move canonical parent/options contracts into model and consume from UI and resolver without introducing duplicate shapes.
- [x] 22.5 `ROOT-R4-READONLY-ACTIVITY-EMPTY-COPY-001` — Pass editability to empty-state copy and use descriptive readonly text; inspect corresponding host subtitle.
- [x] 22.6 `ROOT-R4-UNIFIED-ACTIVITY-PARENT-001` — Thread activityOptions from lead-form item sections through unified host and dialogs to shared editor.
- [x] 22.7 `ROOT-R4-WEEKLY-HARNESS-DUPLICATION-001` — Use shared option-object mounted harness and typed shared row defaults. Keep hoisted vi.mock calls local; retain distinct transition and fake-timer providers. Remove obsolete fixture fields.
- [x] 22.8 `ROOT-R4-WEEKLY-STATE-COPY-001` — Add explicit live/published/archived badge copy. Separate no content from no submissions in empty-state text and corresponding OpenSpec scenario, preserving submissionCount-only publishing.

## 23. R4 review UI and comment lifecycle

Existing contract entry points to confirm: [review-verdict-integrity](../../specs/review-verdict-integrity/spec.md), [record-comment-save-coordination](../../specs/record-comment-save-coordination/spec.md), [reopen-requests](../../specs/reopen-requests/spec.md), [review-acknowledge-placement](../../specs/review-acknowledge-placement/spec.md), [record-dialog-layout](../../specs/record-dialog-layout/spec.md), [risk-stage-integrity](../../specs/risk-stage-integrity/spec.md).

- [x] 23.1 `ROOT-R4-BATCH7-CURRENT-RATIONALE-001` — Keep concise current rationale consistent with actual composed behavior. Preserve valid delete/recreate server identity rationale and live severity-floor symbol.
- [x] 23.2 `ROOT-R4-BATCH7-TEST-QUALITY-001` — Use existing complete fixtures and distinct identities; compile-time negative XOR cases if contract requires them; remove tautological runtime checks and consolidate redundant UI cases.
- [x] 23.3 `ROOT-R4-COMMENT-PENDING-DRAFT-001` — Clear only the submitted draft generation or prevent editing during pending add, following existing composer convention.
- [x] 23.4 `ROOT-R4-REOPEN-CROSS-DRAFT-001` — For existing single-open form, prevent switching responses while saving and disable pending textarea, or scope completion to submitted draft identity. Choose smallest coherent existing lifecycle.
- [x] 23.5 `ROOT-R4-RISK-DUPLICATE-SEEDS-001` — Seed edits directly from risk fields and remove redundant parallel edit seed props through callers/helpers/hooks. Preserve create behavior.
- [x] 23.6 `ROOT-R4-VERDICT-REDUNDANCY-001` — Use known submitted state and eligible control directly after filter.

## 24. R4 slides projection and editing

Existing contract entry points to confirm: [lead-slide-by-product-grid](../../specs/lead-slide-by-product-grid/spec.md), [slide-capacity-signals](../../specs/slide-capacity-signals/spec.md), [slide-inline-record-editing](../../specs/slide-inline-record-editing/spec.md), [status-slide-rendering](../../specs/status-slide-rendering/spec.md), [report-item-display-integrity](../../specs/report-item-display-integrity/spec.md), [lead-surface-name-resolution](../../specs/lead-surface-name-resolution/spec.md).

- [x] 24.1 `ROOT-R4-SLIDE-BLOCKED-ORDER-001` — Evaluate actual risk signals before no-current/next emptiness.
- [x] 24.2 `ROOT-R4-SLIDE-CONFLICT-REFETCH-001` — Make reload return verified success or throw on query error, preserving accurate failure toast.
- [x] 24.3 `ROOT-R4-SLIDE-DEAD-PILLS-001` — Remove dead pill component and redundant activity-pill projection/contract, keeping actual grid activity rows.
- [x] 24.4 `ROOT-R4-SLIDE-DIALOG-CONTRACT-001` — Use canonical record type and risk seed fields.
- [x] 24.5 `ROOT-R4-SLIDE-EMPTY-DUPLICATION-001` — Use shared component with existing title/message.
- [x] 24.6 `ROOT-R4-SLIDE-FORM-TYPE-ALIAS-001` — Import canonical type directly and remove alias/reexports.
- [x] 24.7 `ROOT-R4-SLIDE-HISTORICAL-FALLBACK-001` — Use period-matched fallback or explicit empty historical deck; avoid active activity query when unused.
- [x] 24.8 `ROOT-R4-SLIDE-NO-STATUS-COPY-001` — Describe missing updates or display actual status; align noData terminology.
- [x] 24.9 `ROOT-R4-SLIDE-PENDING-DRAFT-001` — Preserve newer unsent draft or consistently lock editing for in-flight save; tie close behavior to submitted editor identity.
- [x] 24.10 `ROOT-R4-SLIDE-SUMMARY-SCOPE-001` — Use one content scope for grid and summary/readiness, preserving activity parent semantics.

## 25. R5 admin UI mutations and fixtures

Existing contract entry points to confirm: [admin-entity-write-integrity](../../specs/admin-entity-write-integrity/spec.md), [admin-dialog-focus-management](../../specs/admin-dialog-focus-management/spec.md), [admin-snapshot-restore](../../specs/admin-snapshot-restore/spec.md), [admin-stage-assignment](../../specs/admin-stage-assignment/spec.md), [admin-action-log-details](../../specs/admin-action-log-details/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 25.1 `ROOT-R5-ADMIN-ACTION-LABEL-001` — Render all segments with readable final action labels; narrow `statusLabel` to canonical `success | fail` and remove unsupported aliases.
- [x] 25.2 `ROOT-R5-ADMIN-CURRENT-RATIONALE-002` — Correct the current rationale and plain product copy; use the actual shared pending-dialog API when integrating the archive flow.
- [x] 25.3 `ROOT-R5-ADMIN-DEAD-PERIOD-PROJECTION-001` — Remove `AdminPeriodView`, `mapPeriod`, the `snapshot.periods` projection, the re-export, and dead tests.
- [x] 25.4 `ROOT-R5-ADMIN-FOOTER-DEAD-OPTIONS-001` — Keep the actual Cancel/Save contract, derive the disabled policy once, and remove dead props and branches. Preserve the `groupdata-interaction-effect` attribute.
- [x] 25.5 `ROOT-R5-ADMIN-GROUP-FORM-CONTRACT-001` — Preserve nullable group representation through view/form, enforce actual nonempty group where required, and share canonical form type.
- [x] 25.6 `ROOT-R5-ADMIN-TEST-EVIDENCE-002` — Make assertion titles match observations, use typed existing helpers, cover meaningful timer lifecycle and post-mutation list observation; remove the redundant bulky snapshot and impossible multi-owner fixture.
- [x] 25.7 `ROOT-R5-ADMIN-TEST-RATIONALE-001` — Use complete existing test helpers, derive `offsetUnit` from the tuple, remove the tautology, and correct the current rationale and settled assertion.
- [x] 25.8 `ROOT-R5-JOBS-INFINITE-INVALIDATION-001` — Use framework pathFilter or correct infinite key for successful mutation refresh, combine duplicated refresh helper.
- [x] 25.9 `ROOT-R5-JOBS-INVALIDATION-DUPLICATION-001` — Use a focused shared refresh helper with correct infinite-query filters.
- [x] 25.10 `ROOT-R5-JOBS-TYPE-DEPENDENCY-001` — Import `sharedFailedJob` directly, remove the re-derived alias, and type query options without a double cast using the shared pagination fix.

## 26. R5 dashboard and reopen state

Existing contract entry points to confirm: [dashboard-interaction-stability](../../specs/dashboard-interaction-stability/spec.md), [reopen-requests](../../specs/reopen-requests/spec.md), [reopen-compare-and-set](../../specs/reopen-compare-and-set/spec.md), [lead-form-draft-merges](../../specs/lead-form-draft-merges/spec.md).

- [x] 26.1 `ROOT-R5-DASHBOARD-RECORD-COUNT-001` — Use distinct item/risk/decision count for records summary, retaining priority column as a separate classification. Reconcile existing slot-count expectations during systemic model review.
- [x] 26.2 `ROOT-R5-DASHBOARD-STALLED-QUERY-RECOVERY-001` — Provide exact-query cancellation/restart for stuck initial attempts, preserving unrelated ready sources and normal settled refetch behavior.
- [x] 26.3 `ROOT-R5-DISABLED-REOPEN-VALIDITY-001` — When policy disabled, clear or suspend invalid raw-window state and ignore it in save gate, preserving valid committed window. Revalidate on reenable.
- [x] 26.4 `ROOT-R5-REOPEN-CURRENT-RATIONALE-001` — Remove false rationale; retain or remove anchor after checking external/deep-link contract, not merely guessing from comment.
- [x] 26.5 `ROOT-R5-REOPEN-ERROR-CACHE-001` — Refresh the reopen list and pending count after a failed concurrent decision while preserving the unsent response draft; align both mutation surfaces on settled invalidation.

## 27. R5 error boundary contracts

Existing contract entry points to confirm: [client-error-policy](../../specs/client-error-policy/spec.md), [error-trace-correlation](../../specs/error-trace-correlation/spec.md), [loading-layout-stability](../../specs/loading-layout-stability/spec.md).

- [x] 27.1 `ROOT-R5-ERROR-RECOVERY-COPY-001` — Use factual failure/retry copy without an unconditional data guarantee.
- [x] 27.2 `ROOT-R5-ERROR-UI-DUPLICATION-001` — Share minimal recovery content/effect while the global boundary retains its own HTML, body, and styles.

## 28. R5 history query recovery

Existing contract entry points to confirm: [lead-history-summary](../../specs/lead-history-summary/spec.md), [archive-history-ia](../../specs/archive-history-ia/spec.md), [viewer-report-navigation](../../specs/viewer-report-navigation/spec.md), [loading-layout-stability](../../specs/loading-layout-stability/spec.md).

- [x] 28.1 `ROOT-R5-HISTORY-ERROR-EMPTY-001` — Expose load error/partial states from hook and render persistent recoverable failure with Retry in history page.
- [x] 28.2 `ROOT-R5-HISTORY-PAGINATION-ERROR-LOOP-001` — Stop automatic page advancement on next-page error and expose deliberate retry with partial-data state.

## 29. R5 organization and settings forms

Existing contract entry points to confirm: [admin-settings-ui](../../specs/admin-settings-ui/spec.md), [ai-provider-configuration](../../specs/ai-provider-configuration/spec.md), [admin-dialog-focus-management](../../specs/admin-dialog-focus-management/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 29.1 `ROOT-R5-AI-FORM-DEAD-READONLY-001` — Remove unused readOnly option and branch after current caller trace; keep actual provider lifecycle gates.
- [x] 29.2 `ROOT-R5-ORG-IDENTITY-CACHE-RATIONALE-001` — Describe the actual 60-second timed revalidation plus the explicit post-save `/api/revalidate-org` call to `revalidatePath('/', 'layout')`, rather than claiming tag invalidation.
- [x] 29.3 `ROOT-R5-SETTINGS-A11Y-TEST-REDUNDANCY-001` — Keep four real sub-tab success/announcement cases, consolidate duplicate Identity checks, and replace brittle full SVG/HTML snapshots with semantic assertions.

## 30. R5 period history and policy UI

Existing contract entry points to confirm: [period-lifecycle-ui](../../specs/period-lifecycle-ui/spec.md), [period-dual-state](../../specs/period-dual-state/spec.md), [archive-history-ia](../../specs/archive-history-ia/spec.md), [lead-history-summary](../../specs/lead-history-summary/spec.md).

- [x] 30.1 `ROOT-R5-HEAD-PERIOD-UNSAFE-FIXTURE-001` — Build valid typed fixtures using existing test builders.
- [x] 30.2 `ROOT-R5-HISTORY-COMPLETION-NAME-001` — Rename internal value to completionRate through its typed consumers; retain existing calculation and copy.
- [x] 30.3 `ROOT-R5-PERIOD-DEADLINE-TIMEFRAME-001` — Ensure the label/help text explicitly states UTC; preserve round-trip behavior and distinguish the settings default-timezone policy.
- [x] 30.4 `ROOT-R5-PERIOD-POLICY-PENDING-DRAFT-LOSS-001` — Apply coherent revision-aware or disabled-pending form policy, including shared markClean usage.
- [x] 30.5 `ROOT-R5-PERIOD-TEST-HARNESS-RATIONALE-001` — Share the period test harness with an explicit optional `activeError`; correct current assertions/rationale, and preserve the 24 + 17 cases and scope behavior.

## 31. R5 print projection and fidelity

Existing contract entry points to confirm: [pdf-export-integrity](../../specs/pdf-export-integrity/spec.md), [published-portfolio-snapshot](../../specs/published-portfolio-snapshot/spec.md), [report-item-display-integrity](../../specs/report-item-display-integrity/spec.md), [report-record-ordering](../../specs/report-record-ordering/spec.md).

- [x] 31.1 `ROOT-R5-PRINT-CONTENT-FIDELITY-001` — During systemic product review, align printed report content with the authoritative snapshot and preserve the planned/postponed distinction; record the precise print-content contract before implementation.
- [x] 31.2 `ROOT-R5-PRINT-DEAD-LIVE-MODE-001` — Require jobId, remove PrintReportForLiveReport, adapt meaningful existing loading/error/transition cases to job path.
- [x] 31.3 `ROOT-R5-PRINT-PRODUCT-NAMING-001` — Rename the product section/header and tests to the actual domain.

## 32. R5 routes and error recovery

Existing contract entry points to confirm: [report-routing](../../specs/report-routing/spec.md), [ui-role-route-access](../../specs/ui-role-route-access/spec.md), [viewer-report-navigation](../../specs/viewer-report-navigation/spec.md), [session-hydration-error-scoping](../../specs/session-hydration-error-scoping/spec.md), [web-model-type-boundary](../../specs/web-model-type-boundary/spec.md).

- [x] 32.1 `ROOT-R5-ERROR-BOUNDARY-FIXTURE-ISOLATION-001` — Reset thrower.armed=true in beforeEach.
- [x] 32.2 `ROOT-R5-ROUTE-CURRENT-RATIONALE-001` — Correct the current rationale, use the existing feature export, and remove implementation SSO details from normal sign-in copy.
- [x] 32.3 `ROOT-R5-ROUTE-QUERY-ARRAYS-001` — Model `string | string[] | undefined` and consistently ignore non-scalar values as the existing viewer route does; preserve valid single deep links.
- [x] 32.4 `ROOT-R5-ROUTE-TEST-EVIDENCE-001` — Use existing test helpers and typed transport, scope assertions to the actual AST or DOM, restore test-owned environment/storage, and narrow claims.

## 33. R5 shared UI and query contracts

Existing contract entry points to confirm: [compact-overflow-containment](../../specs/compact-overflow-containment/spec.md), [dialog-listbox-a11y](../../specs/dialog-listbox-a11y/spec.md), [loading-layout-stability](../../specs/loading-layout-stability/spec.md), [web-model-type-boundary](../../specs/web-model-type-boundary/spec.md), [web-trpc-test-harness](../../specs/web-trpc-test-harness/spec.md), [surface-token-integrity](../../specs/surface-token-integrity/spec.md), [web-test-timer-discipline](../../specs/web-test-timer-discipline/spec.md).

- [x] 33.1 `ROOT-R5-DIALOG-CALLBACK-RATIONALE-001` — Describe real dependency ownership and remove the false claim that behavior is stable across `readOnly` states.
- [x] 33.2 `ROOT-R5-EDITABLE-LIST-FIXTURE-TYPE-001` — Use satisfies or typed return with correctly typed mock callbacks to validate fixture.
- [x] 33.3 `ROOT-R5-FULLSCREEN-MODIFIER-COLLISION-001` — Limit fullscreen shortcut to unmodified non-composing non-repeated F, preserve ordinary browser shortcuts and form guards.
- [x] 33.4 `ROOT-R5-LIFECYCLE-CACHE-COVERAGE-001` — Include compiled history and period state lists in lifecycle invalidation; reconcile archive/unarchive/create/update/delete paths that currently use only admin subset. Keep precise cache families.
- [x] 33.5 `ROOT-R5-NAV-RAIL-MOCK-PATH-001` — Mock the actual imported runtime/web-env seam and retain intended false feature setup.
- [x] 33.6 `ROOT-R5-QUERY-STATE-FIXTURE-FLAGS-001` — Derive flags consistently from status/fetchStatus/data; intentional isLoading input can default fetching, preserve explicit idle.
- [x] 33.7 `ROOT-R5-SHELL-TEST-RATIONALE-001` — Correct current rationale and remove unused historical test scaffolding only after exact consumer check.
- [x] 33.8 `ROOT-R5-TOOLTIP-LAYER-TOKEN-001` — Use existing semantic popover layer token for tooltip surface/arrow.

## 34. R5 web foundation

Existing contract entry points to confirm: [desktop-surface-composition](../../specs/desktop-surface-composition/spec.md), [ui-control-density](../../specs/ui-control-density/spec.md), [surface-token-integrity](../../specs/surface-token-integrity/spec.md), [web-shared-idioms](../../specs/web-shared-idioms/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 34.1 `ROOT-R5-CURSOR-QUERY-TYPE-BRIDGE-001` — Use correctly inferred actual query hook/types at shared boundary or simple typed direct hooks; eliminate unchecked bridge.
- [x] 34.2 `ROOT-R5-PRODUCT-SUMMARY-UNUSED-UTILITIES-001` — Choose the intended stack spacing in a real desktop review, then add flex or remove inert utilities without changing visual style.
- [x] 34.3 `ROOT-R5-REMINDER-TOGGLE-INSTANTS-001` — Construct the toggle payload while preserving original Date instants and flipping only active entries; keep the date-only editor adapter separate.
- [x] 34.4 `ROOT-R5-USER-TEST-CURRENT-EVIDENCE-001` — Correct current comments and assert actual query filter shape via typed tRPC helper.

## 35. R6 observability dashboards

Existing contract entry points to confirm: [observability-metrics-coverage](../../specs/observability-metrics-coverage/spec.md), [queue-reliability-monitoring](../../specs/queue-reliability-monitoring/spec.md), [manual-publish-telemetry](../../specs/manual-publish-telemetry/spec.md), [prod-trace-sampling](../../specs/prod-trace-sampling/spec.md).

- [x] 35.1 `ROOT-R6-LATENCY-COHORT-COPY-001` — Either explicitly describe independent cohorts or select shared p95 cohort consistently across percentile queries.

## 36. R6 release gates and operations

Existing contract entry points to confirm: [ci-merge-gate](../../specs/ci-merge-gate/spec.md), [deploy-config-integrity](../../specs/deploy-config-integrity/spec.md), [repository-file-accountability](../../specs/repository-file-accountability/spec.md), [operations-local-readiness](../../specs/operations-local-readiness/spec.md), [repository-scope-guard](../../specs/repository-scope-guard/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 36.1 `R6-delivery-tooling-2-F001` — Add product-feedback to both owning inventories and add a focused boundary test that fails when an existing module/slice is absent from the lists.
- [x] 36.2 `R6-delivery-tooling-2-F002` — Match import/export/dynamic-import specifiers rather than arbitrary source text, and add negative ordinary-string/comment fixtures.
- [x] 36.3 `ROOT-R6-DIST-EMPTY-PASS-001` — Require expected application/shared entrypoints and embedded package roots for selected mode; reject empty output.
- [x] 36.4 `ROOT-R6-ENV-001` — Declare `AUTH_DEV_MODE` in the dev task environment; preserve strict filtering and the production prohibition. `NEXT_PUBLIC_DEV_ROLE_SWITCHER` is inferred for Next and is not established as missing there.
- [x] 36.5 `ROOT-R6-OPERATIONS-FIXTURE-CLEANUP-001` — Register cleanup for each owned temporary root using node:test hooks or finally, including assertion failures.

## 37. R6 web instrumentation and tooling

Existing contract entry points to confirm: [prod-trace-sampling](../../specs/prod-trace-sampling/spec.md), [observability-metrics-coverage](../../specs/observability-metrics-coverage/spec.md), [web-env-validation](../../specs/web-env-validation/spec.md), [web-api-url-config](../../specs/web-api-url-config/spec.md), [ci-merge-gate](../../specs/ci-merge-gate/spec.md), [deploy-config-integrity](../../specs/deploy-config-integrity/spec.md), [test-evidence-integrity](../../specs/test-evidence-integrity/spec.md).

- [x] 37.1 `ROOT-R6-DEPENDABOT-GROUP-001` — Put OpenTelemetry family group before generic minor/patch group and clarify that this coupled family is the exception to separate-major policy.
- [x] 37.2 `ROOT-R6-TELEMETRY-COPY-001` — Rename publish-volume panel and correct metric/help formula to actual convention; describe role-export patterns as questions to investigate rather than proof of product health.
- [x] 37.3 `ROOT-R6-WEB-INSTRUMENTATION-001` — Move server instrumentation hook to apps/web/src and update initializer import paths; ensure Sentry initialization and error hook are included.
- [x] 37.4 `ROOT-R6-WEB-TEST-COMMENTS-001` — Remove redundant banners, correct test source path and align stub comment with conditional behavior.
- [x] 37.5 `ROOT-R6-WEB-TYPECHECK-001` — Ensure maintained root Web TypeScript is included in an appropriate typecheck project or relocate tests/modules into src where framework conventions allow; keep build-time files in correct framework locations.

## 38. R7 OpenSpec and documentation currentness

Existing contract entry points to confirm: [admin-reminders-ui](../../specs/admin-reminders-ui/spec.md), [client-error-policy](../../specs/client-error-policy/spec.md), [error-trace-correlation](../../specs/error-trace-correlation/spec.md), [enum-state-hygiene](../../specs/enum-state-hygiene/spec.md), [head-surface-parity](../../specs/head-surface-parity/spec.md), [hot-path-query-performance](../../specs/hot-path-query-performance/spec.md), [jwt-session-integrity](../../specs/jwt-session-integrity/spec.md), [lead-dialog-lifecycle](../../specs/lead-dialog-lifecycle/spec.md), [lead-history-summary](../../specs/lead-history-summary/spec.md), [period-lifecycle-ui](../../specs/period-lifecycle-ui/spec.md).

- [x] 38.1 `R7-docs-specs-1-F002` — Add the three modules and their purposes to the table, or label it non-exhaustive and link a complete module inventory.
- [x] 38.2 `R7-docs-specs-1-F003` — Add `/feedback` with its feature-gated role behavior, or state that the inventory excludes optional surfaces and link the complete route list.
- [x] 38.3 `R7-docs-specs-2-F001` — Promote the Agentation replacement into the durable authenticated-product-feedback spec, remove the obsolete SitePing transport/deep-link/bulk-delete requirements, and retain legacy-row compatibility as an explicit migration rule. Re-run strict spec validation after updating the canonical document.
- [x] 38.4 `R7-docs-specs-2-F002` — Update the spec to reference the current Agentation replacement/upgrade changes and distinguish current product dependencies from retired local tooling; do not require obsolete legacy adapters.
- [x] 38.5 `ROOT-R7-ACTIVITY-WORKFLOW-001` — Reconcile activity alarm scenarios with risk-derived semantics without reintroducing removed item states; audit other occurrences within this spec.
- [x] 38.6 `ROOT-R7-BUCKET-ADR-001` — Align ADR with final authoring projection and canonical spec, retaining Not started/current-next separation and risk-derived alarms; do not restore blocked workflow or provenance-derived status.
- [x] 38.7 `ROOT-R7-CLIENT-LOG-SINK-001` — Specify forwarding to the configured application log sink; qualify apps/api/.logs/app.log as local configuration example if useful.
- [x] 38.8 `ROOT-R7-DIALOG-SHELL-RATIONALE-001` — Keep mount/unmount reset requirement; remove false ban rationale without mandating a new abstraction.
- [x] 38.9 `ROOT-R7-ENUM-ILLUSTRATION-001` — Use current next-send projection and policy enable/pause examples.
- [x] 38.10 `ROOT-R7-HEAD-GRID-CONTRACT-001` — Replace obsolete count-table geometry with reference to canonical action queue while preserving desktop overflow intent.
- [x] 38.11 `ROOT-R7-HISTORY-SCENARIO-FRAGMENT-001` — Restore complete snapshot-preservation outcome to its original scenario; pagination scenario describes null cursor only.
- [x] 38.12 `ROOT-R7-HOTPATH-QUERY-NAME-001` — Describe actual active deadline lookup and independent concurrency.
- [x] 38.13 `ROOT-R7-INDEX-GUARANTEES-001` — Describe recovery of selected admin entities/published documents and guarded reminder retries with explicit uncertain-delivery handling.
- [x] 38.14 `ROOT-R7-JWT-VERIFY-ANCHOR-001` — Correct verify anchor and distinguish session JWT from PDF artifact JWT.
- [x] 38.15 `ROOT-R7-LIFECYCLE-STATE-TERMINOLOGY-001` — Name both lifecycle fields explicitly and link canonical period-dual-state. Preserve existing transition behavior.
- [x] 38.16 `ROOT-R7-REMINDER-COPY-CONTRADICTION-001` — Ban standalone raw kind/audience tokens while explicitly allowing deadline in the human-readable timing phrase.
- [x] 38.17 `ROOT-R7-REPOSITORY-CONTEXT-001` — Allow canonical module-local port files; link durable boundary contract instead of restoring a monolithic service.
- [x] 38.18 `ROOT-R7-ROTATION-READING-001` — Place rotation steps beside AUTH_JWT_SECRET and scope their effect explicitly; move shutdown budget to its own operational heading. Preserve provider encryption key and database password constraints.
- [x] 38.19 `ROOT-R7-SDLC-AUTHORIZATION-001` — Remove the unsupported standing-authorization claim; describe direct push only when explicitly authorized for the task and keep local checks separate from server enforcement.
- [x] 38.20 `ROOT-R7-VIEWER-ONBOARDING-001` — Describe current-period live observation separately from published snapshot access; show that every live observation affects only authorized live sections.

## 39. Final verification and delivery evidence

- [x] 39.1 Verify each changed behavior with the applicable existing and focused regression checks; preserve explicit finding and scenario outcomes.
- [x] 39.2 Complete applicable guarded disposable integration checks and distinguish them from static or mocked transaction evidence.
- [x] 39.3 Complete real desktop browser acceptance for affected flows, including slow/error/pending states and keyboard/focus behavior; resolve applicable annotations only after source, automated, and browser evidence agree. Desktop pass against `pnpm dev` sources (2026-09-11, 1440×900, zero console errors on happy paths): Lead report + Status-overview editor + Escape focus return, Head dashboard, Viewer report, History, Admin users and AI. A forced required-read failure rendered the overview read-only, then a terminal "Editing is temporarily unavailable … Retry editing" state, then full recovery after Retry. No onUI annotations existed to resolve. Zoom/mobile acceptance remains excluded per the recorded scope.
- [x] 39.4 Align durable specifications and curated documentation with the verified behavior; validate every child change. `pnpm spec:check` (`openspec validate --all --strict`) passes 167/167 after the spec and documentation reconciliation.
- [x] 39.5 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm spec:check`; record commands, results, and final source identity.
- [ ] 39.6 Verify unique full source coverage, all mandatory criteria at least 2, zero required local unreviewed/blocked entries, all accepted findings dispositioned, and 100% declared critical scenarios passing. External R13 coverage remains 18 accepted / 19 N/A / 6 unresolved and is not closed by this change.
- [x] 39.7 Report locally tested, committed, pushed, and externally verified state separately; do not infer production readiness from local acceptance.

## 40. Reconciled desktop feedback

Source-bound 34-row reconciliation and exact native criteria are recorded in the external execution evidence. Preserve the twelve proposal rows and UF08 design constraint; UX19 reuses its existing repair and UF07 follows UX20. Checkboxes below record local implementation review only; final native acceptance remains in 39.3 and 39.6.

- [x] 40.1 `ROOT-UI-UX04-001` — Quick Add Risk, Decision и Blocker в Slides не открывает форму
- [x] 40.2 `ROOT-UI-UX05-001` — После Escape из Quick Add теряется место клавиатурного фокуса
- [x] 40.3 `ROOT-UI-UX09-001` — Подтверждение удаления не называет период
- [x] 40.4 `ROOT-UI-UX10-001` — Поиск меняет неверно подписанный счётчик
- [x] 40.5 `ROOT-UI-UX11-001` — Submitted повторно показывает черновой риск в секции
- [x] 40.6 `ROOT-UI-UX12-001` — Полный текст слайда доступен только нестойкой hover-подсказкой
- [x] 40.7 `ROOT-UI-UX13-001` — В режиме Leads секция получает имя другого лида
- [x] 40.8 `ROOT-UI-UX14-001` — Сравнение периодов не раскрывает, что такое A и B
- [x] 40.9 `ROOT-UI-UX15-001` — Скрытая таблица Trends расширяет всю страницу
- [x] 40.10 `ROOT-UI-UX16-001` — В Lead Slides при 1024 контролы периода перекрываются
- [x] 40.11 `ROOT-UI-UX17-001` — Risk и Decision не сообщают об ограничении длины
- [x] 40.12 `ROOT-UI-UX18-001` — New period обрезается при увеличении 200%
- [x] 40.13 `ROOT-UI-UX20-001` — Успешное создание задачи показывает ложный Unsaved update recovery
- [x] 40.14 `ROOT-UI-UX21-001` — Review-comment показывает технический JSON ошибки длины
- [x] 40.15 `ROOT-UI-UX22-001` — History показывает отсутствие данных до завершения загрузки роли
- [x] 40.16 `ROOT-UI-UX23-001` — Будущий период ошибочно помечен Current
- [x] 40.17 `ROOT-UI-UX24-001` — Счётчик слайда не согласует единственное число
- [x] 40.18 `ROOT-UI-UX25-001` — Подсказка статуса показывает внутренние числовые коды
- [x] 40.19 `ROOT-UI-UX26-001` — Tab ставит фокус внутрь скрытых от доступности графиков

## 41. Integration resource boundaries

- [x] 41.1 `ROOT-R6-INTEGRATION-REDIS-TARGET-001` — Guarded Redis integration uses parsed environment fields and selects DB 15 before UUID-scoped cleanup; verified by current source and guarded integration.
- [x] 41.2 `ROOT-R6-INTEGRATION-MAILPIT-SCOPE-001` — Email integration uses recipient-scoped polling and does not delete shared Mailpit messages; verified by current source and live integration.

## Historical scope exclusions

- `ROOT-R1-ACTIVE-001` — Excluded by user scope: account activation/admission behavior; retained as historical provenance only.
- `ROOT-R3-HEALTH-REDACTION-001` — Excluded by user scope: diagnostic disclosure/security hardening; retained as historical provenance only.

## 42. Nested dialog keyboard ownership

- [x] 42.1 `ROOT-UI-NESTED-DIALOG-001`: keep Escape and Tab in the owning modal; preserve the underlying user draft and verify cancellation without mutation.

## 43. Disabled provider status

- [x] 43.1 `ROOT-UI-PROVIDER-DISABLED-001`: derive the retained active revision summary from global availability; verify disabled read and edit states without changing the provider lifecycle.
- [x] 43.2 `ROOT-UI-PROVIDER-READINESS-002`: refresh feature readiness after provider mutations without requiring a page reload.

## 44. September 12 branch and session reconciliation

Execute in dependency order. One owner per bounded task; do not start a second
implementation while the first owner is active. Reuse checks only when their
source inputs match. A checkbox means its full stated acceptance passed.

- [x] 44.1 Pin local SHA for main and the three named feature branches plus the
      supplied session digest; inventory their 1,220 unique changed paths.
      Evidence: branch-review-catalog.json; this supplements the full MVP scope.
- [x] 44.2 Inspect live remote refs, worktrees and current PR/CI. Evidence:
      remote-refs.json and ci-34630878032-failed.log; agentation PR #84 is open,
      its current head failed lint, local editable is one commit ahead, and
      faster-fixes has no remote branch. These observations are not code PASS.
- [ ] 44.3 Reconcile the complete supplied session against actual commits;
      attribute changes or mark unknown, and distinguish user requirements
      from assistant claims. Every requirement has an ID and disposition.
- [ ] 44.4 Reconcile the original full-file snapshot with current tracked and
      relevant untracked files. Preserve history and evidence; assign every
      required path exactly once and record SHA and ownership.
- [ ] 44.5 Review all source paths in that scope; record path/line, scenario,
      severity and applicable spec for each finding. No unreviewed paths remain.
- [ ] 44.6 Review tests, specs, configuration, dependencies and deletions;
      record missing coverage and unsupported acceptance claims explicitly.
- [ ] 44.7 Trace architecture across draft/save/refetch, lifecycle atomicity,
      publication snapshots, jobs and configuration; preserve original scoped
      exclusions and reconcile evidence with the final source.
- [ ] 44.8 Complete the quick-edit child change, including DS-F01/DS-F02,
      read-only actions, retention, browser verification and independent review.
      Follow its tasks rather than duplicating implementation checkboxes here.
      Child `refine-overview-editing-layout` is 4/5 tasks; child task 2.3
      (desktop viewport matrix in the primary browser lane) remains open —
      the 2026-09-16 QE-CLOSE native check was interrupted and unaccepted,
      and QE-04, QE-05, QE-07 and QE-08 still require verification on the
      current source. Historical evidence retained as provenance, not
      acceptance: `refine-overview-editing-layout-qe-acceptance.json`
      (captured 2026-09-14, baseHead c7766a20) recorded the QE-01…QE-09
      table with browser evidence — text-only quick edit versus the full
      Edit action, focus restoration from both editors including the
      retained-memory path, the read-only surface of a submitted period
      with no unload guard, and the IME fix (Escape during an active
      composition used to close the editor and discard composed text).
      That record predates the open checks above and does not close them.
- [x] 44.9 Define and implement the requested Current/Next drag-and-drop in a
      focused child change, preserving lineage and canonical writes; verify
      keyboard alternative, invalid targets and desktop drag feedback.
      Evidence: child `preserve-linked-continuation-dnd` is complete (15/15);
      receipts in file-reviews/preserve-linked-continuation-dnd-*.json. The
      Current result is retained and the linked Next is created/promoted
      through canonical draft writes with the superseded text kept in readable
      history; keyboard parity, Escape/focus restoration, invalid-target and
      locked/foreign rejection are covered by the change's component, shell
      and API suites. Browser drag feedback was exercised through the
      keyboard/menu-equivalent entry points; a synthetic pointer-drag gesture
      is covered by the component tests rather than the browser lane (recorded
      as a gap in preserve-linked-continuation-dnd-browser-lane-4-1.json).
- [x] 44.10 Resolve report-specific Activity name/details semantics in a focused
      child change; verify that later edits cannot alter published snapshots.
      Evidence: child `add-weekly-activity-title` is complete (12/12) with
      file-reviews/ACTIVITY-TITLE-FINAL-GATES.json and
      ACTIVITY-TITLE-FINAL-INVENTORY.json; the weekly title/description are
      stored per lead/week without touching the catalogue, and the published
      snapshot suites prove later edits cannot alter published periods.
- [ ] 44.11 Accept the finite desktop UI/UX scenario matrix with actual browser
      evidence and relevant annotations. Preserve the current style; no mobile.
- [ ] 44.12 Resolve all confirmed findings in bounded patches with regression
      evidence. Verify the forbidden archive placeholder correction at the
      delivery snapshot; preserve the supplied session history outside product
      artifacts without deleting its only copy.
- [ ] 44.13 Independently review substantial final changes with Astra High;
      reconcile every finding, including explicit unavailability if applicable.
- [ ] 44.14 Run applicable format/lint/typecheck/test/build/spec/integration
      acceptance against the final source. All required criteria score at least
      2, all critical scenarios pass, and unreviewed=blocked=0 in local scope.
- [ ] 44.15 Reconcile the original roadmap, catalog and evidence counts; deliver
      within authorized branch scope and verify destination/CI. Resolve owned
      temporary files/processes. Report external/production readiness separately.

## 45. Confirmed feedback transport repair

- [x] 45.1 `DS-SSE-01` — Keep idle Agentation SSE alive through the web rewrite
      proxy. The 30-second heartbeat races the installed proxy's 30-second
      timeout; send heartbeat earlier. Accept with a failing-then-passing
      transport regression and a live same-origin stream that survives beyond
      the former timeout. Preserve replay, scope checks and disconnect cleanup.
      Evidence: agentation-stream-probe.json and agentation-stream-after.json in
      the section 44 evidence root. Before: proxy terminated at 30,050 ms while
      direct API survived 35 seconds. After: proxy survived 35,002 ms with three
      chunks. Regression red→green; 12 transport tests, scoped lint and format
      pass. This is local idle-transport acceptance, not all feedback acceptance.

## 46. Detailed plan for bounded execution

Planning counter: 12 of 12 deliverables accepted (P01–P12).
Final execution awaits repaired source and evidence bindings. Compute subsequent
counts from these checkboxes. Report planning, file-review coverage and product
acceptance separately; never combine them into one completion percentage.

Every resulting execution packet must name its requirement/finding IDs, base
revision and dirty inputs, exact allowed files, prerequisites, one owner,
implementation steps, acceptance commands/scenarios, evidence destination and
stop conditions. A packet is ready only when its input contract is unambiguous.
Product contradictions remain explicit decisions; do not silently choose them.

- [x] P01 Reconcile session requirements. Read the supplied session's complete
      user blocks and the original handoff; map each requirement to its source
      line and an existing or planned change. Distinguish assistant claims and
      unknown commit authorship. Output: complete requirements-to-task map,
      including DS-01 through DS-08 and original MVP requirements. Feeds 44.3.
      Planning acceptance: `requirements-plan-acceptance.json` binds the source
      registers and maps all 167 original User blocks, DS-01–DS-08 and seven
      recovered nested Page Feedback annotations. Original handoff/roadmap
      obligations remain linked. Ambiguous history, product decisions and cleanup
      requests retain explicit open dispositions; mapping is not product approval.
- [x] P02 Fix the review denominator. Reconcile the original snapshot, current
      tracked/relevant untracked files and branch-only changes. Assign one
      review owner per path; include deleted paths with their source revision.
      Output: hashed manifest and disjoint file lists, with no silent exclusions.
      Feeds 44.4; depends on P01 for scope, not on product fixes.
      Planning acceptance: `review-ownership-and-sources.json` covers 2,701
      unique paths in 335 assignments, all 2,622 current-snapshot paths, all
      2,466 original-snapshot paths and 27 branch-version bindings. Every source
      hash was checked. The coordinator is the accountable review owner until
      explicit executor assignment; this grants no ownership of concurrent edits.
      Later source deltas and full review acceptance remain separate.
- [x] P03 Partition the complete file review into bounded packets using P02.
      Each packet lists actual paths, applicable criteria and shared dependencies;
      no arbitrary file-count target substitutes for coherent ownership. Include
      tests, specs, tooling, configuration and deletions. Feeds 44.5 and 44.6.
      Planning acceptance: `file-review-execution-packets.json` assigns 2,701
      paths to 335 bounded review tasks with criteria, mandatory dependencies,
      contracts and hashed source definitions. Independent Astra high accepted
      correction SHA `86acfcd933ba8cbea6050f888ca4185cb51392f9f3ec61b3acadb75d9e8ac9ec`.
      Assign an executor before dispatch; actual file reviews remain open.
- [x] P04 Define architecture review packets for draft/save/refetch identity,
      period dual-state writers, role middleware, publication/PDF snapshots,
      jobs and required configuration. Name concrete entry points and trace
      callers before assigning packets. Feeds 44.7; reuse current evidence only
      after its source dependency check.
      Planning acceptance: seven `architecture-*-review-packet.json` artifacts
      bind concrete entry/dependency files, traced callers, questions, steps,
      output contracts and stop conditions. All 76 source/spec references match
      the immutable snapshot. Actual architecture review and 44.7 remain open.
- [x] P05 Finish the quick-edit execution contract in the existing child change.
      Separate accepted evidence from remaining read-only recovery, user
      isolation, composition input, focus and viewport acceptance. Link DS-01,
      DS-02 and DS-06 without duplicating their implementation tasks. Feeds 44.8.
      Planning acceptance: child tasks.md QE-01–QE-09 plus
      `quick-edit-execution-packet.json` in the evidence root bind 11 owned files
      and 7 dependencies to the verified immutable snapshot. Compare current
      inputs before execution and invalidate affected evidence on drift.
      Child 1.2/2.3/2.4 remain open; this closes only preparation of their contract.
- [x] P06 Specify Current/Next movement semantics from DS-03: move versus copy,
      lineage, linked commitment versus independent Next item, allowed source
      and target combinations, ordering, read-only restrictions and cancellation.
      Identify unresolved product decisions before implementation. Feeds 44.9.
- [x] P07 Turn the accepted P06 decisions into a focused DnD child change with
      pointer feedback, keyboard alternative, invalid-target behavior and one
      canonical write path. Enumerate acceptance per allowed/forbidden transfer;
      use existing dependencies before adding any. Depends on P06; feeds 44.9.
- [x] P08 Define report-specific Activity name/details semantics for DS-04.
      Trace catalogue, per-period fields, carry-forward and snapshot consumers;
      distinguish an intentional catalogue rename from a period override.
      Produce a child change with migration implications and immutable published
      read scenarios. Unresolved semantics must remain explicit. Feeds 44.10.
      Planning acceptance for P06–P08: the user confirmed linked continuation,
      preserved Current/history, and weekly Activity title/details. Child changes
      `preserve-linked-continuation-dnd` and `add-weekly-activity-title` contain
      proposal/design/spec/tasks (15 and 12 unchecked execution tasks). Fresh
      Astra high reviewed both and verified the completed/paused transition
      corrections. This accepts preparation only, not implementation or P09.
- [x] P09 Reconcile the desktop UI/UX matrix and screenshot catalogue. Map each
      required role, page, state, viewport, zoom and keyboard scenario to a task
      and existing evidence or named gap. Include row actions and DnD feedback;
      preserve style and exclude mobile. Feeds 44.11; depends on P05/P07/P08.
- [x] P10 Convert confirmed review findings into small repair packets. Each
      finding has reproduction, severity, source location, contract, minimal
      correction and regression method. Do not attribute a defect to DeepSeek
      without provenance or implement unconfirmed suspicions. Feeds 44.12.
      Planning acceptance: design.md P10 defines the five currently confirmed
      packets with priorities, concrete triggers/source anchors, owning specs,
      smallest correction and regression/remaining acceptance. Their existing
      implementation is not assigned again. New findings extend the queue;
      44.12 and all incomplete product acceptance remain open.
- [x] P11 Specify final independent review and verification packets: current
      format/lint/typecheck/test/build/spec commands, applicable integrations,
      critical-scenario denominator, criterion scoring and evidence source
      identities. Preserve unreviewed=blocked=0 and all criteria >=2; record
      unavailable evidence as unavailable. Feeds 44.13 and 44.14.
      Planning evidence: design.md FINAL-01–FINAL-08, repository package scripts,
      CI workflow and exemplary-code-standard.md verification section. All 22
      explicit repository paths in design.md exist; `pnpm spec:check` passes
      167/167 items (`plan-spec-check.log`). No product execution is accepted by
      this planning checkbox.
      Independent Astra high accepted the final input binding contract and
      separate reviewer assignment as planning preparation. Populate and hash
      the specified inventories after repairs, before execution; this checkbox
      accepts neither future source identities nor product results.
- [x] P12 Publish the executable order and handoff instructions within OpenSpec:
      ready/decision-needed/dependent packets, disjoint parallel lanes, counters,
      journal/catalog links and the exact next packet. Include delivery, CI and
      owned-resource cleanup; external readiness remains separate. Feeds 44.15.

Planning acceptance for P09/P12: `ux-dispatch-catalog.json` binds retained
baseline IDs, imported groups, QE and child scenarios; OPENCODE-START-HERE.md
provides the bounded entry point and complete execution order. Fresh Astra high
verified exact coverage and readiness; both wording corrections are incorporated.
Runtime fixture/source checks and all implementation acceptance remain open.

Execution routing follows the current task-orchestration skill and DSH.md:
simple work locally, one DeepSeek 4.1 Flash Max worker for a suitable bounded
packet, Sol integration and acceptance, and one Astra High gate for material
risk. Inspect saved session activity without duplicating workers or treating
waits as progress. Record limits and actual model/session usage; unknown cost
is not zero. Keep secrets, personal data and unrelated source out of packets.
DeepSeek output alone never checks a task off.

## Confirmed integration cleanup incident — 2026-09-15

- [x] `ROOT-INTEGRATION-DEV-DB-ISOLATION` — Refuse integration cleanup when the
      developer database is unknown or matches the disposable target, before
      pool allocation. Bind the regression tests and independent safety review.
      Contract: `destructive-db-guard`; evidence:
      `execution/r12-integration-cleanup-isolation-20260915.json` in the external
      quality-plan catalog. Local checks pass; independent Astra High review
      found no P0/P1/P2 and independently passed all 12 mock-only unit cases.
- [x] `ROOT-INTEGRATION-FIXTURE-RECOVERY` — Restore the approved synthetic fixture after integration cleanup. Seed validation and Lead/Head/Viewer login with dashboard/report routes are verified. Evidence: external `execution/r12-fixture-recovery-20260915.json` and `execution/r04-status-parity-exact-20260916/head-viewer-recovery.json`. This closes seeded-fixture recovery only; lifecycle acceptance and recovery of old unseeded edits are excluded.

## Item status parity — 2026-09-15

- [x] `R04-ITEM-STATUS-PARITY` — Both Item editors offer five progress states independently of Current/Next placement. The prior 54 focused tests, typecheck, lint, format and strict OpenSpec results retain matching source inputs. Native acceptance passed 4/4: Next in progress, paused with reason, completed, and Current postponed; text-only saves, guarded DB read-back and reload preserve the values. Tested Item business values were restored. Evidence: external `execution/r04-status-parity-exact-20260916/receipt.json`. Full R04/R02 packages and counters remain open.

## Explicit user resume — 2026-09-16

Resume is explicitly authorized. The original full exemplary MVP goal, its criteria, OpenSpec
scope and fixed denominator remain unchanged; the 2026-09-15 stop receipt remains historical.
The current status is 14 total, 1 done, 13 remaining; R02 has 3 groups, R03 has 23 assertions,
R04 has 109, and R05 has 20. The five status-parity receipt source hashes match current files;
the native editor and persisted read-back acceptance remains open. No package checkbox or counter
is promoted by this note. Root code review inspected the diff and all callers/shared save-and-derive
paths against `record-status-derivation`; no new P0/P1/P2 was found in this bounded fix, and
At resume before later acceptance: acceptance waits for native results.

After status parity, the next bounded native batch is **R02-G3**. It covers exact contracts
`contract:lead-form-write-actions:4` and `contract:lead-form-write-actions:5`, plus the exact
atoms `unifiedActivityView persistence`, `own-versus-display payload isolation`, and `Decision
owner persistence`. Reuse the current-source 166/166 baseline and prior native save/read-back,
visibility and unified-view receipts. The matrix must capture pre-state; save/read back a Product
draft with the literal parent/stage payload (which may also bind the R02-G2 parent-stage atom),
reload the classic projection after changing `unifiedActivityView`, exclude Everyone rows from
save/submit payload and durable read-back, and verify Decision owner policy/read-back. Require
Reticle `verified: yes` for each declared consequence, deterministic restore/read-back, then root
Astra Ultra review and acceptance with no additional reviewer before accepting all four G3 atoms or
changing the R02 counter. Route: root
Astra planning/review/acceptance; execution Luna Max or optional bounded DSH 4.1 Flash max; no
fixed worker count. Metadata reconciliation used estimate 5 minutes/10 model turns and hard limit
10/20; this completed metadata-only budget is not a budget for the future G3 native matrix. DSH 0;
reviewers 0.

Current native status (2026-09-16): Decision owner persistence is accepted for existing-edit and
create/default-owner paths; G3 is 1/4 atoms accepted. `unifiedActivityView` remains on contract
HOLD: the setting write and restore are Reticle-verified, but the current Lead route canonicalizes
`mode=edit` to Status Overview, making the specified classic/unified visible consequence
unreachable. Evidence: external
`execution/r02-g3-decision-owner-create-exact-20260916.json` and
`execution/r02-g3-unified-view-route-contradiction-20260916.json`. No package counter changes.
The own-versus-display native atom is also on contract HOLD: Everyone now navigates to the
compiled read-only report, so the retained literal Save/Submit-with-Everyone-loaded scenario has no
current product route. Evidence: external
`execution/r02-g3-own-display-route-contradiction-20260916.json`.
Write-actions 4–5 are reconciled separately: Request Reopen remains reachable but lacks the exact
error-to-success native verdict; Revoke is now owned by Head Dashboard and is unreachable from the
retained Lead-form route. Evidence: external
`execution/r02-g3-write-actions-route-reconciliation-20260916.json`. G3 remains 1/4 accepted.

R02-G2 Product parent/stage persistence now has an exact current-source candidate. One temporary
Product item was saved with `Analysis` and `Design`; Reticle proved the single save request and
post-reload persisted UI, guarded database read-back matched both stages, and exact guarded cleanup
restored the fixture. Focused tests pass 40/40. The current inline editor has no delete action, so
that UI gap is retained as a finding. Evidence: external
`execution/r02-g2-product-parent-stage-exact-20260916.json` (SHA-256
`633c6450eb25882b2ab215a14eddf2846c995155c15048b384dcaa679ee32a5b`). This does not accept G2
or change the 14/1/13 package counter before the remaining atoms and accumulated review.

R02-G2 server-id reconciliation now has an exact current-source candidate. Reticle proved one
create save with a temporary client ID and no stable ID, then one edit save using the exact
server-returned ID and minted stable ID. Guarded DB read-back proved one edited row, unchanged
stable lineage, a regenerated volatile ID, and version progression 18 -> 19 -> 20. Focused tests
pass 58/58; exact guarded cleanup left zero temporary rows and Reticle verified their absence.
Evidence: external `execution/r02-g2-server-id-reconciliation-exact-20260916.json` (SHA-256
`4fc89b80dc44c97bdd05b495ddfd428358683abbfe8ff863ac859df35179285a`). No product code changed;
G2 and the 14/1/13 package counter remain open pending the retained atoms and accumulated review.

R02-G2 same-content version advance now has an exact current-source candidate. A separate
authenticated client performed a content-equal save from version 21 to 22. Reticle then proved the
Lead view refetched that version without a save and that the next user edit sent exactly version 22,
advancing durable state to 23. Exact UI restoration used version 23, returned `verified: yes`, and
left the original text at version 24 with no sentinel rows. Focused tests remain 58/58 and no product
code changed. Evidence: external `execution/r02-g2-same-content-version-exact-20260916.json` (SHA-256
`7b1993c9a94fd910d52d79e0b18e77528a5773f01b1d25c0e5f1c6a29cfca1cb`).
This accepts only the atom as an accumulated-review candidate; G2 and counters remain open.

The accumulated Astra High review of R02-G2 (source SHA
`784411c13d532c1ed860a7a2aad9ad8ad49b73c6`) accepts only 2/8 atoms: server-id
reconciliation and same-content version advance. Six remain HOLD because the literal Reticle
path is missing, incomplete, or reports `unknown`/`no-fault`: autosave echo, dirty external
conflict, quick-add period switch, snapshot return, parent/stage matrix, and paused-reason
lifecycle. No P0/P1/P2 was found; the known P2 is the missing delete affordance in Status
Overview Item editing. Receipt: external `execution/r02-g2-accumulated-astra-review-20260916.json`.
The G2 group and roadmap counters remain open.

The current strict OpenSpec check validates 173/173 items, then the Reticle coverage gate stops
on missing flow `activity-reporting-unit-lead-form`. Registry inspection finds 97 mapped flow names
covering 1,482 outcomes but only 5 saved flow files. Luna diagnosis confirms these mappings are
source-valid; placeholders or `N/A` would be invalid. Receipt: external
`execution/reticle-gate-missing-flow-inventory-20260916.json` (SHA-256
`af7f6550687f4b97b87bf894512fafa35872d7f1c25c88c6b961ef12133e2f73`). This is a P1 final acceptance
catalogue blocker; it does not change R02 counters.
An attempted bounded Luna recording of the first required flow reached its 20-turn/10-minute
limit without producing a flow or Reticle verdict; no placeholder was created and no source or
fixture state changed. The catalogue remains on HOLD.

## Initial native attempt — superseded by exact acceptance below

The primary rollout call/output pairs were extracted into the mode-0600
`execution/r04-status-parity-native-20260916/primary-reticle-transcript.json` and bound with
`execution/r04-status-parity-native-20260916/receipt.json`. They prove editor opening and five
Next-chip verdicts only; status save/persistence, paused-reason read-back and the whole matrix
remain unverified. No writes or baseline changes occurred. The owned lease release was attempted
only for `lease-a24fab0c-7ade-46b6-a275-f3ac31883db3`; the expired first lease, released second
lease and all other leases/sessions were untouched. Execution exceeded the first 5-minute/10-turn
estimate at 65 calls and stopped at the second 10-minute/20-turn cap; DSH 0, reviewers 0, no fake
savings.
Final exact acceptance is recorded in external execution/r04-status-parity-exact-20260916/receipt.json.

## Reticle activity flow reachability — 2026-09-16

Root's bounded Reticle exploration reached the seeded `activity-lead@customreport.local` fixture:
section `...00040a` is activity-only with one activity and one item, but its status is already
`submitted`. Lead exposes only `Request Reopen`; the Head route exposes the activity status strip
and document controls, with no generic Add Item/Add Risk/quick-add controls. The required editable
`activity-reporting-unit-lead-form` therefore remains unreachable without a separate lifecycle
package. No reopen/approval mutation, source or registry change, flow file, or placeholder was
made. One role-switch `observation_lost` was excluded after the session reconnected. Receipt:
external `execution/reticle-activity-flow-reachability-20260916.json`, SHA-256
`f5c3618643aa7f739aae836fc691a2feab632d365a36fbfa006f1052b454f5d2` (mode 0600). Lease and
owned runtime were released; ports 3000/3002 are free. Counters remain 14 total, 1 accepted,
13 remaining; R02 remains open.

## DSH budget wording audit — 2026-09-16

Terra's bounded read-only audit made no DSH call and read no secrets. The local
runner records route, usage and elapsed/session evidence, but not provider
balance or billing. `maxDshInvocations` and `maxElapsedMs` are per-package
safety guards, not account-fund limits. Monetary claims require a separate
complete billing/provider-reported artifact; unknown is not zero. Receipt:
external `execution/terra-dsh-budget-audit-20260916.json`, SHA-256
`148d8e7534ff5d46245a6ded9a27ad5acc6e8af0fcd891ecfa59066a2e9f8ae2` (mode 0600).
The earlier account-budget wording is withdrawn; only the current package
invocation guard was known.

## R02-G2 dirty external conflict exact acceptance — 2026-09-16

The Boris Current-item conflict now has current-source native evidence. Lead
kept unsaved local B while a separate client saved C at version 14 -> 15. The
stale B save returned 409; Reticle returned `verified: yes` for C visibility,
retained B recovery, and the exact conflict message. Reapplying B sent version
15 and persisted version 16; UI restoration returned the seed text at version 17. Guarded local cleanup restored version 14 and left zero sentinel rows.
All four Reticle verdicts are `yes` with zero `unknown`, `no-fault`, and console
errors. Evidence: external
`execution/r02-g2-dirty-external-conflict-exact-20260916.json`, SHA-256
`1537e868eb400cf3296cc77626f3c56b5e39ec52dace518f82d56f5fbcbceb41`.
This promotes the atom to accumulated-review candidate only; G2 and R02 remain
open pending the retained atoms and a refreshed accumulated review.

## R02-G2 accumulated acceptance refresh — 2026-09-16

Primary acceptance rechecked the exact source SHA, four Reticle `yes` verdicts,
durable reapply at version 16, and cleanup invariants. G2 now accepts 3/8 atoms:
server-ID reconciliation, same-content version advance, and dirty external
conflict. Autosave echo, quick-add period switch, snapshot return, parent/stage
matrix, and paused-reason lifecycle remain HOLD. G2 and R02 stay active; the
roadmap counter remains 14 total, 1 accepted, 13 remaining. Receipt: external
`execution/r02-g2-accumulated-acceptance-v2-20260916.json`, SHA-256
`f15dc7aabc9dedfa16e81735bd0afaab1214883855dc61599307dd1421cf2417`.

## R02-G2 quick-add generation fix — 2026-09-16

A TDD regression confirmed a P2 defect: returning A -> B -> A restored a
quick-add dialog that period navigation had closed. The red result returned
`{ week: "next", seq: 1 }` instead of null. The minimal guarded render-phase
generation reset is covered by the same test; focused Vitest (3/3), Prettier,
ESLint, and web typecheck pass. Native Reticle is not claimed because ports
3000/3002 belong to a preexisting external session. The quick-add/snapshot
atoms remain HOLD until that lifecycle reports `verified: yes`. Evidence:
external `execution/r02-g2-quick-add-generation-fix-20260916.json`, SHA-256
`f2972b850b87d8299445cc0909e2e0f18653091879a93bc6a1f05157d42b265e`.

## DRAFT plan decisions (owner-ordered 2026-09-17 — bullets only, not tasks; counts unchanged)

- D1 strict: 39.6 keeps full coverage, criteria≥2, unreviewed=blocked=0, 100% critical; R13 external (18/19/6) not counted in PASS.
- Lane permit: owner allows provisioning the 15 `customreport_e2e_lane_[a-o]_test` DBs at execution; each run still gated by destructive-guard + per-run consent; bootstrap does not create lanes (manual).
- Freeze procedure: no SHA frozen yet — P1 attributes the dirty tree first, then `git rev-parse HEAD` = frozen SHA; all later steps bind to it.
- Plan items P1–P7, pilot P1, two DoDs, Tier A/B detail and ASCII map: `proposal.md` DRAFT sections above (single source until transcription after P1 ownership resolution).
- Owner figures to re-measure at inventory: ~3124 outcomes, ~3081 excluded/153 specs, ~43 mandatory in 7 specs, ~1663 missing refs, 5 flows vs 97 names, batches LEAD ~565 / ADMIN ~254 / HEAD ~119 / VIEWER ~51 / SHARED ~2092 / OTHER ~1396.

## Audit plan tasks (owner order B, transcribed 2026-09-17 — one campaign; these checkboxes are the plan's own)

- [x] P1 — Attribute the dirty tree and freeze the SHA (read-only): list every uncommitted path with owner/cause, revert-or-keep each with an owner, then `git rev-parse HEAD` = frozen SHA; bind all later steps to it + hashes of task-owned uncommitted files. Accept: attributed inventory + frozen SHA recorded; stop after two failed attribution attempts. Executed 2026-09-18 (goal 3c96657e): all 141 status paths attributed to pre-existing commits (table `/tmp/wr-p1-attrib-20260918.txt` per run), frozen SHA `a41779cf5`, owner KEEP ALL; rebound to `870da1d8` after the owner's skills-only commit (P7 section, design.md).
- [ ] P2 — Execute 44.5+44.6+44.7 reviews (paths/config/architecture) within `apps/*`, `packages/*`, `prisma/*`, specs; read-only. Accept: per-path findings with severity/spec + explicit gap list.
- [ ] P3 — Execute 44.11 desktop matrix with `verified: yes`-only browser evidence on `apps/web` (needs dev servers + synthetic records permit at execution). Accept: finite matrix + evidence, no `unknown`/`no-fault` passes.
- [ ] P4 — Resolve all 231 accepted findings as bounded product patches + regression evidence (owner D2). Accept: every finding dispositioned, regressions green; new scope → child change.
- [ ] P5 — Independent review of the final diff (44.13) or recorded explicit unavailability. Accept: review returned + reconciled, or unavailability on record.
- [ ] P6 — Full gates on the frozen SHA (44.14) + strict 39.6 (full denominator, criteria≥2, unreviewed=blocked=0, 100% critical). Accept: commands+results+source identity logged, all green.
- [ ] P7 — Counts/delivery/cleanup (44.15); production items stay a separate track. Accept: reconciled counts, CI verified, temps cleaned. Note: the `adapt-openspec-to-reticle` 6.4 mandatory-core growth was owner-canceled 2026-09-20 (Reticle removed, agent-browser selected); the stale `design.md` machinery description is reconciled with a superseded banner instead of core growth.

## Tier A closeout (Sisyphus phase 1 — measured 2026-09-18, gate-logic exact)

- Mandatory entries: 20 in 7 specs (audit-target-coverage 3, ci-merge-gate 3, manual-publish-telemetry 3, published-section-order-determinism 2, role-coverage-gate 3, search-contract-precision 3, section-save-payload-bounds 3).
- Mandatory unclassified = 0, empty-proofs = 0, unresolvable/missing refs = 0 (checked with the gate's own exclusion logic: excludedSpecs dict + 4-key declared outcomes + in-repo file resolution).
- 74 references added by this phase went to 10 EXCLUDED specs (registry hygiene, zero gate effect); mandatory refs were already 20/20 at HEAD — reported honestly, no gate progress claimed for them.
- Floor 20 >= 20; `pnpm spec:reticle` green; `pnpm spec:check` green (173 passed, 0 failed; INFO-only long-requirement hints).
- Tier A CLOSED. Next: lane provisioning (15 DBs, guard + per-run consent each op).

## Owner decision 2026-09-18: single database, no lanes (supersedes lane permit)

- MVP работает на одной `customreport_e2e` (dev `DATABASE_URL`, тесты и E2E уже указывают на неё; проверено read-only 2026-09-18: единственная пользовательская БД в контейнере, лейнов не существует).
- `customreport_e2e_lane_[a-o]_test` остаются разрешены гардом, но не создаются без нового распоряжения; критерий «15 lane-БД» из цели заменён на single-DB readiness (reset + migrate + seed перед каждой фазой).
- Зафиксировано в `AGENTS.md` (MVP single-database policy) и `proposal.md` (3 пометки SUPERSEDED).

## Tier B closeout (Sisyphus phase 3 — browser, single-DB demo seed, 2026-09-18)

- LEAD PASS: login -> /lead/report -> edit item description -> Save update -> new text re-rendered in item actions.
- HEAD PASS: role switch -> /head/dashboard -> review section -> Acknowledge -> button flips to disabled "Acknowledged".
- ADMIN PASS: role switch -> /admin -> reopen tab (1 pending) -> Respond -> Approve -> "0 requests / No pending reopen requests", badge cleared. Negative: head on /admin sees "Page unavailable for your role".
- VIEWER PASS: role switch -> /reports/latest renders (products, activities, period selector) -> Previous period navigates Week 38 -> Week 37 with content.
- Evidence: DOM-consequence asserts + screenshots per flow (agent-browser artifacts in session dir). No native reticle verdicts: daemon absent (client ws://localhost:4400/reticle unreachable, see api dev log) — flows asserted via rendered consequences instead.
- Cost note: Reticle dev overlay repeatedly covers click points (chat-head/pill/strip); workarounds: overlay Exit/minimize + scrollintoview + semantic text clicks (~10 extra steps).
- Open observation (not Tier B blocking): admin Jobs tab shows "1 Failed Job In DLQ" since demo seed; cause unread (no PdfExportJob rows; BullMQ DB15 lookup empty). Needs one admin Jobs-tab read before 44.x close.

## 39.6 missing flow closed (2026-09-18): activity-reporting-unit-lead-form

- Authored `.reticle/flows/customreport-web-60381801/activity-reporting-unit-lead-form.json` (6th flow file): lead login -> "Add item to <activity>" -> fill Description -> Save update -> item renders under the activity. Anchors are role-kind with observed accessible names; per-step element expect + text success assert; shapes mirror the repo flow validator (role/testid anchors, native tools/actions, expect keys).
- Executed substance in browser as lead1 on single-DB demo seed: item "Проверил интеграцию с новым API (39.6 flow check)" created under activity "Исследование новых интеграций" (was "No items yet"), screenshot assert. VERIFIED via rendered consequence.
- Native reticle replay NOT done: no daemon (ws://localhost:4400/reticle unreachable); flow file awaits replay when a daemon exists. Not counted as native PASS.

## P6 battery (frozen SHA a41779cf5 + 4 task-owned files, 2026-09-18)

- GREEN: typecheck 6/6, build 5/5, units shared 868 + persistence 85 + api 3040 + web 3267 + root 198 + 61, spec:check 173/173, spec:reticle (20 mandatory, floor met).
- RED (all foreign, untouched per task-boundary rule): format:check — 12 `.agents/skills/openspec-*/SKILL.md` (my 4 files clean); lint stops at repository-cleanliness (138M+1?? structural); root safety — 1 operations-config-docs assert (`.env.test.example` 2026-09-15 vs test 2026-09-01 mismatch, predates session).
- Freeze note: 137 -> 139 dirty paths vs P1 count; my writes proven by mtime to be exactly 4 task-owned files (registry, AGENTS.md, proposal.md, tasks.md); residual unattributed pre-existing drift, no new paths from me, no commits.

## 44.13 disposition: recorded unavailability (2026-09-18)

- No independent reviewer available in-session. Advisor (oracle) is explicitly NOT a substitute for final independent review per execution constraints; worker-delegation model quota is exhausted (429, ~20d). External/Astra review needs owner scheduling. NOT counted as pass.

## 44.15 strict counts (criteria>=2, unreviewed=blocked=0, R13 external excluded from PASS)

- Tier A mandatory core: 20/20 refs resolve, 0 unclassified/empty/refless; floor 20>=20.
- Browser evidence: 6/6 DOM-asserted (LEAD edit, HEAD acknowledge, ADMIN approve, VIEWER period nav, head-vs-admin negative gate, activity lead-form). Native reticle replay: 0 (daemon absent) — recorded as blocked, not pass.
- P4 231 findings: NOT executed (outside Sisyphus ordered steps) — open, not pass.
- Strict 39.6 verdict: NOT PASS (red foreign-dirt gates + 0 native replays + open P4 + unresolved R13 external). Everything green is listed above with exact numerators; nothing unreviewed is counted.

## First native replay (2026-09-18, daemon 3.1.0, CLI verify): PARTIAL 2/6

- PASS: reticle-install-smoke-2026-09-15, weeklyreport-reticle-viewer-period-dropdown-explicit-20260916.
- FAIL activity-reporting-unit-lead-form: "Add item to ..." button anchor not found (rendered for agent-browser, absent at replay speed — timing/lazy-section suspect).
- FAIL reticle-head-review-flow: "Respond" absent — premise consumed by my own verified Tier B approve (0 pending now). Needs reseed, not a product fault.
- FAIL reticle-lead-read-flow: role==head at assert — cross-flow session leakage (shared browser profile, earlier flow left head session; Lead link missing when authenticated).
- FAIL reticle-reviewer-read-flow: radio "Leads" anchor gone — UI drift or state suspect, inspect before touching.
- Next: guarded reseed (restores premises) -> re-verify -> triage anchors/order with 2-attempt rule. No free passes.

## Native replay verdict (2026-09-18): PARTIAL 2/6, high confidence

- PASS native: reticle-install-smoke-2026-09-15, weeklyreport-reticle-viewer-period-dropdown-explicit-20260916.
- FAIL premises (not product): head-review (Respond consumed by verified Tier B approve — reseed restores), lead-read (cross-flow head session leakage), reviewer-read (radio "Leads" anchor drift), activity-form (Add-item anchor absent at replay speed).
- Reruns blocked by infra, not product: `query timed out after 8000ms` x3 on lead/report (app healthy: 17ms/307, no errors); daemon/MCP ownership churn (CLI- vs proxy-spawned daemons orphan each other's sessions) + wire skew (MCP 2.14.0 vs daemon 3.1.0). Retried with reseed + single-flow isolation + drive+MCP query — same wall. Path paused with evidence; DOM-asserted 6/6 stands as Tier B evidence.

## Reticle infra wall (2026-09-18, recorded with evidence)

- One native verdict obtained: PARTIAL 2/6 (high confidence). Reruns blocked, not by product.
- `drive` holds the session and does not exit on its own: two orphans killed (29:59, 23:01 hangs). Rule: never run bare `drive`; always outer `timeout`, then kill the stray listener.
- Daemon churn is structural: CLI-spawned vs MCP-proxy-spawned daemons orphan each other's sessions; `verify` refuses while any daemon holds 4400; query path times out (5x `query timed out after 8000ms`, app healthy) + wire skew (MCP 2.14.0 vs daemon 3.1.0).
- To unblock: restart the agent (fresh MCP server per skew message) or update its reticle package; then single-driver replays. Needs owner action.

## P4 packet acceptance (2026-09-18, autonomous slice)

- ARCHIVE-PLACEHOLDER: `openspec/changes/archive/` absent entirely — placeholder deletion verified present; full cleanliness still structurally red on foreign dirt (recorded, not forced).
- FEEDBACK-IDLE: `agentation-sse.test.ts` 11/11 pass (heartbeat + cancellation) — fresh narrow regression evidence.
- Sizing truth: the "231" have no patch-ready packets on disk (5 defined packets are already implemented in the dirty diff; their remains are acceptance, not code). 231-minus-5 needs P2 review execution first — solo forecast is weeks, not turns; needs owner call on volume/delegation.

## QE-CLOSE acceptance (2026-09-18, browser + unit)

- Browser as lead1: Edit item -> typed "(QE-CLOSE typed)" via trusted keystrokes -> Escape closes, triggers restored; reopen shows SAVED text (typed gone).
- Ruled INTENDED, not a finding: colocated tests specify "cancels with Escape without saving" and "retains typed text across a same-item refresh and cancels to refreshed text" — observed behavior matches both. Initial retained-after-Escape expectation was my conflation of QE-RETAIN (navigation) with explicit-cancel (discard); corrected, no packet filed.
- Regression: `status-overview-item-preview.test.tsx` 11/11 green. Focus-restore-to-trigger unassertable with agent-browser (no focus readout) — recorded limitation, not claimed.

## QE-RETAIN A→B→A: INTERRUPTED (tool channel, 2026-09-18)

- Typed marker present in open editor; navigated to History (B); return leg (A) hit agent-browser IPC timeouts x2 (35s + 60s) while the app itself answers in ~23ms (curl 307) with no errors — automation channel wedged, not product. Slice paused per stop rule; no verdict claimed either way. Unit side (provider lineage) untouched this pass.

## Проект плана 2026-09-18 (goal mu6s113y-6vif62 — предъявлен на согласование, не исполнение)

- Статус-блок, single-DB refresh шагов 4–5/рисков/P6 и находки F8–F10 — в `proposal.md` и `design.md` этого change; чекбоксы выше не менялись.
- Открытые обязательства без изменений: `complete-exemplary-mvp-review` 39.6, 44.3–44.7, 44.11–44.15 + P1–P7; связанный `adapt-openspec-to-reticle` 3.2, 3.3, 4.1–4.4, 5.1–5.3, 6.4 — ссылки по ID, копий нет.
- Пилот P1 (read-only) обоснован в `proposal.md`; два DoD разделены там же; собственная дельта фазы — только `proposal.md`/`design.md`/`tasks.md` (mtime 12:56–12:57 + `git diff --stat`); полное дерево содержит предсуществующую кампанейскую дельту (не этой фазы, не откатывать).

## Native replay full tally (2026-09-19, daemon 3.1.0, MCP lease): 7/7 flow files PASS

- Lease-context replay (`__reticle_session` survives doc-nav; focused, unthrottled) after SDK 2.14.0->3.1.0 alignment removed the wire skew.
- PASS: reticle-install-smoke-2026-09-15; weeklyreport-reticle-viewer-period-dropdown-explicit-20260916 (viewer-role lease); activity-reporting-unit-lead-form (repaired: startPath lands on authed surface, fill uses `{value}`, success=net reports.saveDraft + text); reticle-lead-read-flow; reticle-reviewer-read-flow; reticle-head-review-flow (re-authored: Respond->Approve->net admin.respondReopenRequest + "Request approved"); head-dashboard-clarity-head-dashboard (43/43 steps + success, new dense journey).
- Premise restoration: head-review pending reopen request recreated through the product path (lead dmitry@ Request Reopen dialog -> leadForm.requestReopen 200 {success:true}) — no reseed needed; then head lease replayed Respond->Approve natively.
- Repairs recorded: "0 records" substring-collided with "10 records" -> "No edits yet"; "Reminder queued" split text nodes -> net review.dashboard 200; SPA goto preserves React useState (expanded rows persist) -> hard reload before replay.
- Reminder evidence: POST reminders.dispatchPending body carries exact active ruleId a0000000-...-0801; response alreadyRequested:1 (dedup within cycle) — mechanism proven, no "no-active-rule".
- Revoke All (2) confirmation: dialog opened (49 events), Cancel closed it — destructive action guarded, no mutation fired.
- Supplementary live asserts (beyond flow-file grammar): aria-expanded toggles, leadId .013 = Волков body match, post-mutation refetches. Evidence: /tmp/wr-cont/TB-head-dashboard-native-replay.json + prior session records.
- Prior PARTIAL 2/6 notes remain the pre-lease record; session leakage/anchor drift resolved by lease + repairs above.

## PDF failed-job retry implementation plan — 44.12 / FR-032 (2026-09-20)

**Goal:** A manual retry of a failed PDF export can complete against the same
immutable publication without a stale failure event undoing the retry.

**Architecture:** Serialize retry and terminal reconciliation on the existing
`PdfExportJob` row. Read current queue state after acquiring that lock; await
queue retry inside the revival transaction so rejection rolls back the revival.
Keep pending-only completion CAS and canonical artifact adoption.

**Stack:** Existing TypeScript, Prisma/PostgreSQL, BullMQ and Vitest only.
**Contracts:** `openspec/specs/queue-reliability-monitoring/spec.md:69-88`;
`openspec/specs/pdf-export-integrity/spec.md:267-300,431-457`.
**Decision evidence:** `/tmp/wr-cont/advisor-pdf-retry-plan-20260920.json`.
The two-step revival hook was rejected because reconciliation can observe the
old failed queue state and because retry rejection can strand a pending row.
This repairs existing behavior; it adds no owner requirement or new retry policy.

One delegated worker owns all interfaces below; use subagent-driven-development.
Preserve concurrent changes. No schema/migration, UI, dependency or public DTO
changes. Local unit work is authorized; actual DB/Redis execution is a separate,
still-unapproved verification phase. No commit or publication is implied.

- [x] Add failing regressions in the existing PDF repository/service, admin jobs,
      queue adapter, processor and reconciliation scheduler tests. Cover failed
      retry through completion; missing/pending/completed rows; wrong payload
      job/report/requester identity; queue retry rejection; delayed old failure;
      and two concurrent retry requests. Preserve existing terminal-race cases.
- [x] Implement a per-export row-lock operation in
      `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts` and its
      `PdfExportRepository` boundary in `pdf-export.ports.ts`.
      All work under a lock uses the same transaction, without nested transactions.

  ```ts
  await tx.$queryRaw`
    SELECT "id" FROM "PdfExportJob"
    WHERE "id" = ${jobId} FOR UPDATE
  `;
  ```

  Require stored `failed` and matching `jobId`, `reportId`, `requestedBy`.
  Revival changes only `status`, `error`, `filePath`, `checksum`.
  Preserve publication timestamp, snapshot, groups, requester and template.
  Await the queue retry before transaction completion; propagate rejection,
  with no unconditional compensating write or claim that a lost Redis
  acknowledgement proves no enqueue occurred.

- [x] Change terminal reconciliation to consume a job identity and a lazy loader
      `() => Promise<PdfExportTerminalState | null>`. Invoke the loader only
      after the row lock. Update `pdf-export.processor.ts` failure callbacks and
      `pdf-export-reconciliation.scheduler.ts`; a now-waiting/active job must not
      apply a previously captured failed state.
- [x] Wire PDF-specific retry through `modules/admin/jobs.service.ts`,
      `admin-jobs.port.ts`, `infrastructure/bullmq/admin-jobs-queue.adapter.ts`,
      `bootstrap/jobs-service.ts` and `bootstrap/app-services.ts`.
      Keep identity internal and reminder retry unchanged. An ineligible row
      performs no queue retry and is not reported as newly retried.
- [x] Run the affected existing non-DB Vitest suites, API typecheck, targeted
      ESLint/Prettier; review the actual diff independently. Record source hashes
      and exclusions in `/tmp/wr-cont/44-12-patch-record-*.json` and TASK-047.
- [ ] Prepare and obtain specific authority for real row-lock/queue verification
      on the permitted disposable target; run applicable live admin/Reticle
      acceptance. Unit results alone do not close this feature or 44.12.

Source/unit receipt: `/tmp/wr-cont/44-12-patch-record-pdf-retry-20260920.json`.
166 tests passed; the import-only final correction passed its 20 affected tests.
Targeted lint/format and API types passed. Independent source review passed;
the seven reviewed production hashes remain unchanged. Live verification stays open.

## Single-database integration alignment and PDF runtime preparation (2026-09-20)

The owner decision of 2026-09-18, recorded in `AGENTS.md` and this change's design,
requires local dev and integration phases to share `customreport_e2e`. The old
integration helper and durable guard specification still require different targets.
Reconcile that contradiction; do not change the common parser, target allowlist,
per-operation consent, or the rule against provisioning additional lanes.
Independent advisor approved this bounded extension; decision evidence is
`/tmp/wr-cont/advisor-single-db-helper-plan-20260920.json` and TASK-047.

- [x] Add mocked regression checks for a common logical PostgreSQL target,
      including equivalent credentials/loopback aliases; reject mismatched
      database/port, unknown target, production, unsafe URL and absent consent
      before pool allocation or SQL. Preserve memoized-client target-drift checks.
- [x] Require matching explicit `E2E_DATABASE_URL` and `DATABASE_URL` in the
      integration helper after the unchanged destructive guard. Reconcile
      `destructive-db-guard` specification with the existing owner decision.
      Verify focused unit tests, lint/format, types and strict spec validation;
      no real database operation is included in this implementation step.
- [x] Prepare one existing-helper-based PDF integration suite in
      `apps/api/src/modules/admin/jobs.pdf-retry.integration.test.ts`: two
      concurrent retries; stale failure after retry; second-attempt failure;
      real queue retry rejection with PostgreSQL rollback; and three separate
      job/report/requester identity mismatches. Use real PostgreSQL and BullMQ
      only during the later authorized phase, with Redis DB 15 and owned prefixes.
      Assert immutable publication provenance and final terminal idempotency.
      Synchronize on events/promises with bounded timeouts; do not depend on sleeps.
- [ ] Present the concrete runtime phase for separate owner authorization after
      source checks and independent review. Run the seven new scenarios plus the
      existing PDF integration suite only with exclusive ownership of the single
      database, guarded row cleanup, explicit fixture seeding and complete owned
      queue/process cleanup. This is not authorization to reset, seed or run now.

The runtime phase proves queue/database state transitions, not PDF rendering or
distributed atomicity. Lost Redis acknowledgements and uncertain PostgreSQL commits
remain explicit limitations; UI/Reticle acceptance stays separate.

## Shared validation and carry-over bounded queue batch (2026-09-20)

Independent plan review: `/tmp/wr-cont/advisor-shared-carry-plan-20260920.md`.
Preserve existing contracts and lifecycle locks; no new database constraint.

- [x] Deduplicate section-record parent/stage validation through a leaf helper,
      preserving read early return, write issue accumulation, exact issue paths,
      messages, historical leniency and outcome-only rules. Pin parity with tests.
- [x] Build carry-over clones from explicit write fields; omit read-model extras
      while preserving lineage, identities, dates and source immutability.
- [x] After the existing Report lock, filter new planned carry-over clones against
      current parent membership before deduplication. Preserve current rows and
      readback-derived lineage/counts. Cover item/decision and product/activity
      detach-after-plan cases; real concurrent detach remains separate evidence.
- [x] Reconcile lineage-shape finding with prior accepted optional hardening;
      nullable history endpoints are not a required XOR contract or a fixed bug.
- [x] Complete remaining product-parent race: serialize admin StageAssignment
      save/reassign/delete with graph then stable all-editable Report locks, reusing
      the existing helper. Recover compound-key P2002 only in a new transaction.
      Preserve current policy and add bounded ordering checks and locally attached
      carry-over integration fixtures. Plan: `/tmp/wr-cont/advisor-stage-assignment-lock-plan-20260920.md`;
      real database execution remains separately authorized, not a source-check PASS.
- [x] Independently inspect the resulting changes and run focused tests, lint,
      format and relevant typechecks before accepting these queue claims.

Source/unit evidence: `/tmp/wr-cont/44-12-patch-record-carry-parent-20260920.json`;
164 tests, targeted lint/format/API types and independent source review passed.

- [ ] Run the separately authorized 18-case PostgreSQL phase and verify cleanup;
      source/unit acceptance above does not prove actual concurrent DB ordering.
      Plan: `/tmp/wr-cont/stage-assignment-live-phase-plan-20260920.md`.

## Existing test contracts and internal textarea ref (2026-09-20)

Independent bounded plan: `/tmp/wr-cont/advisor-next-small-plan-20260920.md`.

- [x] Make analytics published-floor mock require both lifecycle fields; preserve
      three consumer scenarios and prove either missing predicate breaks coverage.
- [x] Cover reporting-group and reminder-policy input normalization in the existing
      mapper test, including null/default and UTC validity dates.
- [x] Narrow internal textarea ref types through risk/decision field callers to
      the object refs they already produce. Pin external/internal object focus,
      verify web types and open/close one existing dialog without saving.
- [x] Record reminder timing wording as optional editorial consistency: the
      specification uses an illustrative phrase, not an exact unit-copy constraint.

## Remaining bounded evidence corrections (2026-09-20)

- [x] Add the Activities parent-query matrix case and prove a late assistant
      response cannot restore the previous user's exchange after identity change.
      Evidence: 42 focused tests, web types/lint/format, independent source review.
- [x] Pin settings null/undefined/enum mapping and isolate the snapshot identity
      negative to exactly one schema issue; remove a decorative database-state
      parameter that never changed the unit fixture. Evidence: 36 focused tests,
      API types/lint/format and independent source review.
- [x] Reuse the canonical group-id helper in PDF telemetry while retaining the
      admin early return and immutable publication-group filter. Evidence: 27
      focused tests, API types/lint/format and independent source review.
- [x] Prove the real auth route composition through bounded local HTTP stubs;
      include fail-closed boot, dev/SAML exclusion, callback posture and cleanup.
- [x] Correct the four documented reference/inventory/env-semantics gaps without
      changing product contracts; validate durable specs and existing env tests.
- [x] Add the existing report-page position-width landmark to the overview
      skeleton, with one failing-then-passing regression for that branch.
      Preserve markup, styles and loaded behavior; live desktop acceptance remains
      in the frozen candidate matrix.

## Owner decision 2026-09-20: Reticle removed, agent-browser (Vercel) selected

Owner explicitly removes the Reticle integration and selects agent-browser
(Vercel) as the primary browser-verification route. Backlog TASK-047 records
the removal; TASK-036 covers Jev as a separate optional global tool. This supersedes every
Reticle-specific mechanism referenced above; prior sections stay as history and
are not re-marked.

- All source-coverage and critical-scenario denominators are unchanged: the
  normative-outcome corpus, the declared mandatory core of 20 in 7 specs, and
  the finite browser matrices keep their identities. Only the proof surface for
  not-yet-passed browser evidence changes.
- Open items that name Reticle (live admin/Reticle acceptance, pending replays,
  flow mappings) are not passed; their acceptance now routes through the
  replacement mechanism under the same predeclared-consequence rules.
- Tool status: root-verified live proof — navigation and screenshot succeeded
  on agent-browser 0.38.1; WeeklyReport app UI acceptance via this route is
  still pending and is not claimed.
- Verified durable archive: `reticle-removal/reticle-project-before.tar.gz`
  (root-verified). The earlier `/tmp` evidence is lost; recovery stays active.
  Reference this durable path, not the lost `/tmp` records.

Execution checklist — all items stay unchecked until root accepts:

- [ ] Archive the remaining old Reticle evidence under the durable
      `reticle-removal/` path and record what could not be recovered.
- [x] Remove the integration remnants (`.reticle/` assets, `spec:reticle` /
      `test:reticle` scripts and validator, MCP wiring) with owner-scoped edits
      only.
- [x] Reconcile instructions and docs (`AGENTS.md`, `RETICLE.md`,
      `docs/onboarding.md`, `docs/sdlc.md`, related OpenSpec texts) to the
      replacement route.
- [ ] Re-run applicable checks after removal (`spec:check`, lint/format, gates)
      and bind results to the tested source identity.
- [ ] Connect agent-browser (Vercel) and drive one real flow end to end on this
      app; until a verified observable consequence exists, the replacement is
      unproven here.

## TASK-047 44.11 contract and source rebind (2026-09-24, static-only)

- [x] 44.16 Apply the owner-accepted feedback decisions to this change and the
      canonical spec, then derive `matrix-ratified-20260924-v5` bound to the
      isolated freeze candidate: D-06a inbound-link inclusion scenario, D-06b
      retired SitePing facet kept without a replacement autofocus or workbench
      navigation control, and the CoreDev external-ingress prohibition
      pending a separate SSO/token specification. Static contract sync and
      source rebinding only; every execution status stays `not-run` and no
      runtime acceptance is claimed.
