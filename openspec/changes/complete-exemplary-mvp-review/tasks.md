# Exemplary MVP review execution

Completed repair checkboxes record verified local corrections. The final verification section remains the release acceptance gate; a local correction does not establish overall readiness. Review observations and baseline test runs are not completion evidence. Close an item only after current-source reconciliation, implementation or evidence-backed disposition, and applicable verification. Detailed accepted evidence is indexed by the retained finding ID outside the repository.

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
