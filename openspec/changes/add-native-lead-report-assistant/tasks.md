## 1. Shared contracts and snapshot compatibility

- [x] 1.1 Implement the exact strict shared `SearchPlan` and tool-input wire shape from `docs/llm-report/lead-report-assistant-search-plan-contract.md`, plus output/grouping, assistant request, product-outcome union, clarification options, answer metadata, and citations; add the colocated canonical-status Zod schema, compose every existing canonical enum, and add only the documented assistant-owned derived Decision schemas.
- [x] 1.2 Implement every documented SearchPlan bound and cross-field refinement for period/author modes, subject expansion, filter-to-record-kind compatibility, structured/semantic residuals, priority combinations, comparison grouping, requested limits, exhaustive intent, and explicit empty/null semantics, with no field defaults.
- [x] 1.3 Add exhaustive shared schema tests covering valid plans, every invalid combination, strict unknown-field rejection, safe-text bounds, and generated JSON Schema required fields.
- [x] 1.4 Extend `sectionActivitySchema` with backward-compatible `jiraAccounts`, update snapshot/shared fixtures, and prove both new alias round-trips and old snapshot parsing.
- [x] 1.5 Export only the new public schemas/types through the curated `@customreport/shared` barrel and run shared package type/tests before API work.

## 2. API search-module architecture and exact domain core

- [x] 2.1 Behavior-neutrally move the existing full-text SearchService and Prisma repository into `application/` and `infrastructure/`, update `search.module.ts`/`index.ts`/imports, add `search` to the invariant-bearing lint placement, and prove all existing `search.query` tests remain unchanged and green.
- [x] 2.2 Define readonly internal report occurrence, section scope, resolved plan, candidate identity, candidate context, and discriminated Item/Risk/Decision/Product-status/Stage-status/Activity-status types without exporting authorization internals to shared/web.
- [x] 2.3 Implement and unit-test period selection for default current-plus-three-published, published-only counts, named periods, open/reopened live selection, and one-source-per-report exclusion.
- [x] 2.4 Implement and unit-test NFKC/dash/whitespace/case entity-reference normalization and exact alias indexing for author names, current/frozen product names, Activity names, and Jira accounts.
- [x] 2.5 Implement accessible-only entity resolution and short-lived actor-bound clarification-token encode/decode using a purpose-separated token kind/key, including ambiguous, inaccessible, tampered, expired, cross-user, and ACL-changed cases.
- [x] 2.6 Export `filterSectionToSharedProducts` through the report-sections public facade if needed and implement candidate projection that can accept only own or already-filtered foreign visible occurrences.
- [x] 2.7 Unit-test candidate projection for all six kinds, private foreign-field exclusion, current derived statuses, legacy optional lineage, product/activity parents, and non-deduplicated carry-over occurrences.
- [x] 2.8 Implement composable immutable exact predicates and deterministic sorting for subjects, stages, kinds, item/risk/decision/status filters, carry-over, priority, structured ordering, and complete-set hard limits.
- [x] 2.9 Implement deterministic aggregates, comparison/grouping, supporting status facts, evidence budgeting, truncation metadata, source IDs, and citation validation; test counts before truncation and exhaustive overflow.

## 3. Canonical live/snapshot retrieval

- [x] 3.1 Add the application-owned report-search repository contract and Prisma adapter that loads current live section read models and parses selected `publishedSnapshot` sections without creating a persistent SearchDocument projection.
- [x] 3.2 Implement per-report Lead own-section proof, current shared-non-archived-product scope, and application of `filterSectionToSharedProducts` before candidate projection.
- [x] 3.3 Add PostgreSQL integration fixtures/tests proving current draft inclusion, immutable snapshot authority, mutually exclusive live/snapshot sources, default and explicit period ranges, and no published-live-row drift.
- [x] 3.4 Add authorization integration tests proving own Activity note visibility, foreign product-only visibility, exclusion of foreign Activity/private content, current-assignment historical ACL, and no inaccessible entity/clarification leak.
- [x] 3.5 Expose a structured retrieval tracer-bullet through `ReportAssistantService` with fake planner/answer ports and prove exact no-result, count, comparison, source metadata, and no-filter-broadening outcomes before pgvector is added.

## 4. PostgreSQL, Prisma, and explicit configuration

- [x] 4.1 Inventory every dev/test/UAT/production PostgreSQL image and update it to a PostgreSQL 15 pgvector-compatible image, preserving database-name safety suffixes and documenting volume/backup verification for any non-disposable environment.
- [x] 4.2 Add `CREATE EXTENSION vector`, `SemanticEmbedding`, its unique key, and vector-dimension CHECK to the single init migration and Prisma schema without modifying canonical report models.
- [x] 4.3 Regenerate Prisma and add database integration tests for extension availability, vector round-trip, dimension rejection, model/version isolation, and idempotent embedding upsert.
- [x] 4.4 Add every required Mistral/report-assistant value to `envSchema` with no defaults, update env-schema tests, every tracked compose/E2E/test environment, and secret documentation; keep real `MISTRAL_API_KEY` values out of Git.
- [x] 4.5 Verify a disposable `_dev`/`_test` reset applies the edited init migration under the destructive guard and record that production reset is forbidden.
- [x] 4.6 Detect whether each target database has already applied the edited init migration: use the edited init only for disposable/uninitialized environments; for an initialized production database, stop and create/review an additive forward migration containing the same pgvector DDL before deploy, never reset or mark edited history as newly applied.

## 5. Mistral and semantic embedding infrastructure

- [x] 5.1 Re-verify the official Mistral contracts recorded in `docs/llm-report/mistral-report-assistant-integration-2026-08-04.md`; add `@mistralai/mistralai` v2 through pnpm and use explicit server/model configuration without SDK fallbacks or `-latest` aliases.
- [x] 5.2 Define minimal application-owned `ReportLanguageModelPort` and `EmbeddingPort` interfaces plus deterministic fake adapters for planner repair, answer repair, provider failure, and reproducible vectors.
- [x] 5.3 Implement canonical semantic text/version/hash creation for Item, Risk, Decision, and noted Activity status; test that product/stage/note-less status facts are non-embeddable and metadata names do not affect hashes.
- [x] 5.4 Implement the parameterized pgvector repository that validates finite query vectors, filters active provider/model/version/dimensions and allowed hashes, performs exact cosine ranking, and applies the configured threshold with stable tie-breakers.
- [x] 5.5 Implement complete-cache detection and bounded synchronous read-through; test current-draft hash freshness, model changes, full-set ranking, below-threshold no-results, and the prohibition on partial or silent structured fallback.
- [x] 5.6 Add the single-source semantic queue name/default job options and an enqueuer whose deduplicated jobs contain only canonical locators and expected hashes.
- [x] 5.7 Implement the `RawBullMqProcessor` semantic worker with canonical live/snapshot reload, hash recheck, unchanged idempotent upsert, and safe changed/deleted-record completion.
- [x] 5.8 Add queue/worker tests for no report text in payloads, duplicate jobs, stale hashes, deleted sources, provider failures, retry policy, lifecycle shutdown, and retrieval-triggered recovery without autosave hooks.

## 6. Assistant orchestration, tRPC, and observability

- [x] 6.1 Implement versioned planner and planner-repair prompt builders exactly from `docs/llm-report/lead-report-assistant-prompt-contract.md`, with the generated `search_report_entries` schema, one tool, `toolChoice: "any"`, `parallelToolCalls: false`, minimal trusted context, strict response parsing, bounded timeout/transport handling, and one validation-repair attempt.
- [x] 6.2 Implement versioned grounded-answer and citation-repair prompt builders exactly from the prompt contract, using Custom Structured Outputs, isolated untrusted evidence data, token usage capture, one citation-repair attempt, and no unknown-source acceptance.
- [x] 6.3 Complete `ReportAssistantService.answer` orchestration across planning, resolution, canonical retrieval, exact filtering, optional complete-set ranking, aggregates/context, grounded answer, and every explicit product outcome.
- [x] 6.4 Add service-interface tests with fakes for structured/semantic success, ambiguity, no match, invalid-plan repair/failure, indexing pending, oversized sets, truncation, citation repair/failure, provider failure, and prompt-injection records.
- [x] 6.5 Add a Lead-only assistant router using the canonical `leadProcedure`, shared input/output parsing, existing error mapping/audit conventions, and role-coverage tests rejecting every non-Lead role.
- [x] 6.6 Wire search repository, Mistral/embedding adapters, pgvector repository, queue, worker, service, module facade, `AppModule`, `main.ts`, and `createAppRouter` without adding cross-module deep imports or report-write dependencies.
- [x] 6.7 Add bounded private metrics/logs for outcome, mode, latency, candidate counts, cache hit/miss, repair counts, model, and usage; add tests/source guards proving no questions, report content, prompts, answers, embeddings, IDs, or names are logged/labeled.
- [x] 6.8 Add golden prompt tests for Russian/English planning, explicit-null behavior, default self/current-plus-three semantics, semantic residual extraction, exact-only queries, prompt-injection evidence, server-authoritative aggregates, insufficient evidence and citation repair; record prompt versions without logging prompt bodies.

## 7. Native Lead Chat UI

- [x] 7.1 Build a controlled right-side `Sheet` in the existing Lead report slice using current shared/UI primitives and tokens, with responsive width, focus return, accessible title/description, scroll containment, and no new route.
- [x] 7.2 Add the active Chat control immediately after `AgentReviewComingSoon` in `LeadFormToolbarControls`, preserving `--toolbar-control-h`, edit/slides placement, neighbor ordering, and absence from head/admin/viewer/preview/print surfaces.
- [x] 7.3 Implement one-question form state and tRPC integration for idle/planning/searching/answer/clarification/index-pending/no-results/oversized/error states, preventing duplicate submit while in flight.
- [x] 7.4 Render grounded Markdown through the project's safe rendering approach, explicit truncation/insufficient-evidence state, and authorized source links to `/lead/report/<reportId>` without invented row anchors.
- [ ] 7.5 Move the one-question state and mutation behind a small in-memory interface mounted inside the authenticated `(app)` layout; keep clarification resubmission intact, preserve the active exchange across Sheet close/reopen and client-side navigation, replace it on the next submission, and reset it on logout/user change without durable storage.
- [x] 7.6 Add Testing Library coverage for toolbar geometry/order, Lead-only visibility, keyboard/focus behavior, responsive Sheet states, busy/error retry, clarification, pending, citations, safe rendering, and unchanged Agent-review ComingSoon behavior.
- [x] 7.7 Add/update the existing Lead report behavioral E2E catalog scenario and Playwright coverage for opening Chat, an MSW/fake successful answer, clarification, source navigation, and no console/accessibility regressions.
- [ ] 7.8 Update the Sheet behavior and English helper copy so closing changes only visibility, then add Testing Library coverage for preserved draft, pending, error, clarification, no-results, and successful-answer states without transcript accumulation.
- [ ] 7.9 Extend Playwright coverage to prove close/reopen and internal source/page navigation preserve the active exchange, while logout or a full document reload clears it and no Web Storage entry is created.

## 8. Verification, rollout, and documentation

- [x] 8.1 Run focused shared/API/web unit tests after each slice and remove any temporary fixture duplication, unused exports, deep imports, or comments that narrate implementation history.
- [x] 8.2 Verify new production files are below 250 lines, functions are at most 50 lines with target cognitive complexity below 10, pure layers are immutable/no-`let`, and no lint/config exemption was added.
- [x] 8.3 Run `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm lint:md`, `pnpm test:integration`, and `pnpm test:e2e:integration`; record exact commands and results in the implementation handoff.
- [x] 8.4 Live-boot API and web from source with complete explicit Mistral/pgvector/Redis configuration; smoke-test existing save/submit/publish/search/PDF paths and the new Lead Chat while confirming no real provider is contacted by automated tests.
- [x] 8.5 Review changed web production strings for English-only compliance, run the route catalog check, and verify no new route or hidden feature flag was introduced.
- [x] 8.6 Write a command-level production runbook and update onboarding with separate dev/prod Mistral workspaces and secrets, pinned model IDs, explicit EU server, paid-plan/training/retention/ZDR approval, pgvector image and direct migration order, initialized-database detection, port-443 egress preflight, config-before-code rollout, cost/usage monitoring, smoke checks, application rollback, and the rule that production databases are never reset.
- [x] 8.7 Rehearse the runbook against a disposable clone of production topology: verify model availability with `/v1/models` without report content, verify the extension/table/vector dimensions over the direct database connection, prove API fail-fast on incomplete config, and smoke existing report writes before Chat.
- [x] 8.8 Run `openspec verify add-native-lead-report-assistant` (or the repository's current equivalent), resolve every spec/task/design mismatch, and leave the change ready for archive only after all implementation and gates are complete.

### Verification record

- `pnpm --filter @customreport/api db:generate`: passed.
- `pnpm typecheck`: passed (5 Turbo tasks).
- `pnpm lint`: passed (ESLint, Stylelint, Prisma, status literals, Playwright image sync, dependency-cruiser, Knip).
- `pnpm test`: passed with 186 API files/1,862 tests, 219 web files/2,038 tests, 20 shared files/438 tests, and 5 Prisma files/16 tests.
- `pnpm build`: passed (5 Turbo tasks; Next static generation completed).
- `pnpm lint:md`: package script is not defined; no Markdown lint command is available in this repository.
- `pnpm test:integration`: package script is not defined; equivalent API integration command passed with 47 files/327 tests and 2 skipped tests against disposable Postgres/Redis/Mailpit services.
- `pnpm test:e2e:integration`: passed with 49 tests; the focused PDF rerun also passed both enqueue and worker-completion tests. The Lead Chat E2E used deterministic route interception and made no provider call.
- `node e2e/sweep/catalog-check.mjs`: passed with no route drift.
- `openspec validate add-native-lead-report-assistant --strict`: passed; this repository has no `openspec verify` command.
- 8.7 rehearsal: configured Mistral `/v1/models` returned 53 models and all three pinned IDs were available; production Compose rendered with disposable mock DB/SAML values; direct Postgres reported 15.0018, pgvector 0.8.2, 1024 dimensions, `SemanticEmbedding`, and its dimension CHECK; UAT-like migration detection allowed edited init while production detection stopped for additive migration; incomplete API config exited 1 before boot; existing report-write flows passed in the source-backed E2E suite; the real browser Lead Chat smoke returned `ok` with one citation/source link and zero console/page errors.
- 8.8 verification: the repository's `openspec-verify-change` workflow reviewed all 56 task checkboxes, 24 requirements, 62 scenarios, design decisions, directory placement, and implementation/test evidence; no critical mismatch remained.

The rehearsal used only seeded mock report data. The provider request was
metadata-only for `/v1/models` plus one authorized browser Chat smoke; no
production database, report, or credential was exposed in command output.
All 56 implementation and verification tasks are complete; the change is
ready for archive.
