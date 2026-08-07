## Context

CustomReport already has a flat full-text `search` module, GIN-backed `tsvector` columns, immutable `Report.publishedSnapshot` output, an invariant-bearing `report-sections` module, and an established Lead report toolbar. The existing search surface is a direct UI query over Item/Risk/Decision/Project and has different role/scope semantics; it must remain behaviorally unchanged.

The assistant adds a security-sensitive read path across current editable content and published history. It must preserve current Lead cross-author policy, treat report text as untrusted model input, avoid making AI infrastructure part of canonical report writes, and fit the repository's domain-first layering and exemplary-code ratchets.

### Before

```text
search.query -> SearchService -> tsvector repository -> flat search hits

lead report toolbar -> Agent review placeholder -> report controls
```

### After

```text
lead Chat sheet -> leadProcedure -> ReportAssistantService
  -> Mistral typed plan -> accessible entity resolution
  -> live current section OR published snapshots
  -> existing Lead ACL lens -> immutable candidates -> exact filters
  -> optional complete-set pgvector ranking
  -> deterministic aggregates/context -> grounded Mistral answer
  -> validated citations

existing search.query -> unchanged public contract and behavior
```

The owner-facing summary and infrastructure explanation are maintained separately at `docs/llm-report/lead-report-assistant-decision-summary.md`.

## Goals / Non-Goals

**Goals:**

- Provide a native Lead-only Chat control beside Agent review.
- Answer single-turn questions over the current editable report and selected published snapshots.
- Preserve exact parity with current Lead own/cross-author visibility.
- Make structured filtering authoritative and semantic ranking subordinate.
- Ground every generated answer in server-prepared evidence and validated citations.
- Keep report save, submit, reopen, publish, PDF, and existing search behavior independent from Mistral, Redis, and pgvector availability.
- Land as exemplary, immutable, boundary-compliant TypeScript without new lint exemptions.

**Non-Goals:**

- Head/admin/viewer access, persistent conversations, fuzzy/transliterated entity resolution, saved answers, ANN indexing, product/stage embeddings, or a general AI platform.
- Replacing `search.query`, modifying canonical report writes, or introducing an AI-owned report projection.

## Decisions

### 1. Reuse and deepen the canonical `search` module

The report assistant belongs to `apps/api/src/modules/search`. The module becomes invariant-bearing and gains `domain/application/infrastructure` layers. Its public facade exports the existing `SearchService`, new `ReportAssistantService`, and `SearchModule`; consumers continue to use `index.ts`.

Target shape:

```text
modules/search/
  domain/
    candidate.ts
    candidate-projector.ts
    candidate-filter.ts
    entity-reference.ts
    entity-resolver.ts
    context-builder.ts
    citation-validator.ts
  application/
    search.service.ts
    report-assistant.service.ts
    report-assistant.ports.ts
  infrastructure/
    search.prisma-repository.ts
    report-search.prisma-repository.ts
    mistral-language-model.adapter.ts
    mistral-embedding.adapter.ts
    pgvector-embedding.repository.ts
    semantic-index.queue.ts
    semantic-index.processor.ts
  search.module.ts
  index.ts
```

The exact split may use additional single-purpose files to meet size limits, but must not create shallow pass-through services. Pure rules remain functions. The application service owns port types; Nest binds production adapters at `search.module.ts`.

Alternative rejected: a top-level `assistant`/`ai` module. It would split ownership of report search, add another canonical domain and lint zone, and duplicate retrieval logic.

### 2. Use a controlled right-side Sheet, not a new route

The active Chat control is inserted immediately after `AgentReviewComingSoon` in `lead-form-toolbar-controls.tsx`. It opens a controlled right-side Sheet using `@customreport/ui/components/ui/sheet`, which already exists and is used in the application. The Sheet is bounded on desktop and full-width on narrow screens, keeps the report mounted behind it, traps/restores focus through Radix, and displays input, progress, answer, clarification, pending, empty, oversized, and error states.

The one-question state and mutation live behind a small in-memory interface mounted inside the authenticated `(app)` layout, below `SessionProvider`. That seam survives client-side navigation between authenticated pages even when the Lead-only Sheet trigger is temporarily unmounted. Closing the Sheet changes only its open state: draft input, the submitted question, resolution tokens, pending/error state, and the latest outcome remain available when it is reopened. A new submission replaces the prior active exchange; the module never accumulates a transcript. A full document reload, logout, or authenticated-user identity change destroys or resets the state. No question, token, or answer is written to `localStorage`, `sessionStorage`, IndexedDB, cookies, URL parameters, TanStack persistence, or the server.

Chat UI belongs to the existing report-pages/report-sections slice. It reuses current buttons, input/textarea, typography, border, surface, spinner, skeleton, alert, scroll-area and source-link patterns. It does not use bespoke design tokens or a new route, so route catalog drift is avoided. The control stays present in edit/slides mode and is absent from preview, print, head, admin, and viewer surfaces.

Alternative rejected: a standalone assistant page. It loses current report context, adds navigation/catalog surface, and feels separate from the report workflow.

Alternative rejected: browser or server persistence. The requested continuity is limited to the active authenticated client session; durable storage would retain sensitive report-derived content and introduce lifecycle, deletion, and cross-user isolation requirements without providing conversation history.

### 3. Define one strict external SearchPlan in `packages/shared`

The tool input is the exact strict shared Zod object fixed in `docs/llm-report/lead-report-assistant-search-plan-contract.md`. Its field names, enum literals, requiredness, empty/null semantics, derived Decision classifications, cross-field refinements and examples are normative. The plan covers:

- periods: include current, published mode (`none/latest/all/named`), count, references;
- authors: `self/all_visible/selected`, names, include self;
- subjects: parent kinds, product/activity names, linked activities;
- canonical stages and record kinds;
- item type/workflow, risk severity, decision state/timing, canonical health, carry-over and priority;
- retrieval: `structured/semantic_ranked` plus nullable residual query;
- output: `list/count/summary/comparison`, grouping, requested limit, exhaustive intent.

All fields are required at the tool boundary; the contract defines which empty arrays and nullable values mean no filter. Cross-field rules live in `.superRefine()`. No model-controlled IDs, similarity settings, candidate limits or ACL switches exist. JSON Schema is generated from the Zod source, never hand-maintained.

Decision state and timing do not exist as persisted canonical enums. The shared assistant contract therefore owns `decisionStateSchema` (`open/resolved`) and `decisionTimingSchema` (`without_deadline/overdue/due_today/upcoming/resolved_on_time/resolved_late`) as query-time classifications derived from `resolvedAt`, `deadline`, trusted server date and configured timezone. They do not alter the Decision model. The existing `CanonicalStatus` type gains a colocated Zod schema so the assistant composes rather than duplicates that vocabulary.

Resolution tokens remain in the validated assistant request beside the question. They are applied by the server during entity resolution and are not copied, transformed or generated by Mistral as SearchPlan fields.

Mistral is forced to call only `search_report_entries`. One invalid call receives one repair containing compact Zod issues; a second invalid call yields `invalid_plan`.

### 4. Separate untrusted and resolved plans

`SearchPlan` is untrusted model output. `ResolvedSearchPlan` is an API-internal readonly type containing selected report occurrences, per-report section scopes, verified entity IDs, canonical filters and output intent. It is not exported to web/shared because it carries authorization context.

Resolution order is fixed:

1. resolve selected report occurrences and one source for each;
2. prove caller report access;
3. construct accessible section occurrences and apply foreign lenses;
4. build an accessible-only alias catalog;
5. resolve authors/products/activities/period references;
6. produce IDs, clarification, or no accessible match.

Reference normalization performs NFKC, dash normalization, trim, whitespace collapse and lowercase. Exact accessible aliases include author name arrangements, current/frozen product names, Activity names and Jira accounts. No fuzzy matching, transliteration or semantic entity selection is allowed.

Clarification tokens are short-lived, actor-bound, typed tokens. Use the existing JWT dependency with a distinct `kind`/audience and a purpose-derived signing key from `AUTH_JWT_SECRET`; verification still re-runs current ACL. This avoids a new operator secret while preventing a clarification token from being accepted as a session token.

### 5. Choose canonical sources before authorization and projection

Current editable `open/reopened` reports use live report-section read models. Published history parses `Report.publishedSnapshot`; a report occurrence never uses both. Default period selection is current plus three latest published snapshots. Four published means four snapshots and no current draft.

The repository may reuse public report-section include/mapper contracts only through that module's facade. It must not deep-import sibling internals or reconstruct a second mutable report model.

For own sections, retain authorized product/activity content. For foreign Lead sections, require caller section ownership in that report and current non-archived shared products, then call the existing public `filterSectionToSharedProducts`. The filtered occurrence is the only value accepted by `CandidateProjector`.

New snapshots add `jiraAccounts` to `sectionActivitySchema` with `default([])` solely for frozen-snapshot backward parsing. This is not product configuration fallback.

### 6. Project transient discriminated candidates

`CandidateProjector` creates readonly Item, Risk, Decision, Product-status, Stage-status and Activity-status candidates. Every occurrence carries report/source/period, section/author, subject/stage and occurrence identity. Item/Risk/Decision carry optional lineage separately; repeated carry-over occurrences are not deduplicated.

Candidates exist only in memory. There is no `SearchDocument` table and no text projection written during report saves. Exact candidate predicates compose immutably; OR applies inside one dimension and AND across dimensions.

Canonical health uses existing derived values: project traffic light, stage derived status and `activity.derivedStatus ?? activity.status`, adapted through the shared canonical status functions. Raw status is not recomputed by a second algorithm.

### 7. Make vector search a complete-set ranking cache

Only Item text; Risk risk/impact/mitigation; Decision text/impact; and Activity name plus non-empty note receive semantic content. Product/Stage status and note-less Activity status remain exact facts. Author/product/stage labels are not embedded.

Canonical semantic input is versioned and hashed from input version, kind and text. `SemanticEmbedding` stores only hash, provider, model, version, dimensions, vector and timestamps. It has no report/record/ACL/text columns and no candidate foreign key.

Use unbounded PostgreSQL `vector` with a `vector_dims` CHECK. Filter by active provider/model/version/dimensions and allowed hashes before exact cosine ordering. No ANN index is introduced because structured filtering hard-bounds the comparison set and model dimensions may change.

Before ranking, compare all semantic-capable candidate hashes with cache rows. Missing count at or below `REPORT_ASSISTANT_READ_THROUGH_LIMIT` is embedded and upserted synchronously. A larger gap enqueues every missing locator and returns `semantic_index_pending`; partial ranking and silent structured fallback are forbidden.

### 8. Reload canonical data in the embedding worker

BullMQ jobs contain source, report/section, kind, record locator and expected hash, never report text. Job IDs derive from active provider/model/version/hash to deduplicate. The processor extends `RawBullMqProcessor`, reloads live or snapshot content, rebuilds semantic input, verifies the expected hash, and idempotently upserts only an unchanged existing record. Deleted/changed records finish without an embedding.

Indexing is retrieval-triggered in v1; no autosave hook or scheduled prewarm is required. This avoids a `report-sections -> search` write dependency. Read-through and subsequent queries recover missed jobs.

### 9. Use Mistral behind two internal ports

`ReportLanguageModelPort` exposes typed planning and grounded-answer operations. `EmbeddingPort` exposes query and batch-document embedding. Production adapters use the official ESM-only `@mistralai/mistralai` v2 TypeScript SDK behind application-owned ports; exact model IDs remain required environment configuration. Tests use deterministic fakes and never call Mistral.

Planner context contains question, actor role, trusted server date/timezone and tool semantics only. Resolution tokens stay in the validated application request and are applied after planning. Answer context contains question plus the authorization-filtered GroundingBundle. Provider transport retry/timeouts are bounded in the adapter and distinct from the one semantic repair attempt.

The prompts are versioned product code, not environment text. Implement the four exact contracts documented in `docs/llm-report/lead-report-assistant-prompt-contract.md`: planner, planner repair, grounded answer and citation repair. Trusted instructions and untrusted report data remain in separate messages; report content is serialized as data and is never interpolated into the system instruction. Prompt versions participate in tests and observability but prompt text is never logged.

The owner-selected initial UAT baseline is `mistral-medium-3-5` for planning and answers, and `mistral-embed` with 1,024 dimensions for embeddings. These are pinned IDs rather than `-latest` aliases. `mistral-small-2603` is a cost-oriented replacement only after it passes the same Russian/English planner, citation and prompt-injection evaluation suite. Production uses the explicit EU API server unless the owner approves another data region.

### 10. Compute aggregates and citations on the server

ContextBuilder receives the complete retrieved set. It computes counts, comparison groups and attention/status summaries before evidence budgeting. Structured ordering is current/newest period, author, subject, kind, priority and stable key. Semantic ordering is score, recency and stable key.

Every evidence occurrence receives a local `S1...Sn` identifier and authorized report/section/period/author/kind/subject metadata. The answer model returns Markdown, cited IDs and insufficient-evidence. Unknown citations receive one repair and then a controlled generation failure. Sources link to `/lead/report/<reportId>`; v1 does not invent unsupported row anchors.

`requestedLimit` cannot bypass server limits. Counts/comparisons use the complete set. Ordinary bounded output marks truncation; explicit exhaustive or semantic sets above hard limits return `result_set_too_large`.

### 11. Treat AI configuration as explicit deployment configuration

Add required validated environment values with no schema defaults:

```text
MISTRAL_API_KEY
MISTRAL_PLANNER_MODEL
MISTRAL_ANSWER_MODEL
MISTRAL_EMBEDDING_MODEL
MISTRAL_EMBEDDING_DIMENSIONS
MISTRAL_API_SERVER
REPORT_ASSISTANT_INPUT_VERSION
REPORT_ASSISTANT_SIMILARITY_THRESHOLD
REPORT_ASSISTANT_CANDIDATE_LIMIT
REPORT_ASSISTANT_READ_THROUGH_LIMIT
REPORT_ASSISTANT_EXHAUSTIVE_LIMIT
REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET
REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS
REPORT_ASSISTANT_PLANNER_MAX_TOKENS
REPORT_ASSISTANT_ANSWER_MAX_TOKENS
REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE
REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET
```

Every tracked dev/test/UAT/production compose and E2E environment supplies non-secret values explicitly; real secrets remain outside Git. Config and secret provisioning must precede deployment of code that requires them.

Safe initial values for implementation and UAT are:

```text
MISTRAL_PLANNER_MODEL=mistral-medium-3-5
MISTRAL_ANSWER_MODEL=mistral-medium-3-5
MISTRAL_EMBEDDING_MODEL=mistral-embed
MISTRAL_EMBEDDING_DIMENSIONS=1024
MISTRAL_API_SERVER=eu
REPORT_ASSISTANT_INPUT_VERSION=1
REPORT_ASSISTANT_SIMILARITY_THRESHOLD=0.55
REPORT_ASSISTANT_CANDIDATE_LIMIT=500
REPORT_ASSISTANT_READ_THROUGH_LIMIT=16
REPORT_ASSISTANT_EXHAUSTIVE_LIMIT=200
REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET=8000
REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS=30000
REPORT_ASSISTANT_PLANNER_MAX_TOKENS=1500
REPORT_ASSISTANT_ANSWER_MAX_TOKENS=2000
REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE=32
REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET=8000
```

The threshold and budgets are conservative application starting points, not provider guarantees. The owner approves them after representative UAT; changes require no schema migration, except changing embedding dimensions creates a new cache partition and must be deployed with a compatible vector CHECK.

### 12. Preserve load-bearing invariants and existing behavior

- **Period dual-state:** untouched; no assistant code writes Report lifecycle fields.
- **Role-coverage gate:** new procedure uses canonical `leadProcedure`; no custom middleware chain.
- **Destructive DB guard:** dev/test/UAT may reset under the current MVP rules; production must never reset. The init migration may be reshaped only under the repository's current pre-production policy.
- **Deferred-feature pattern:** Chat ships active and complete; Agent review remains the existing ComingSoon control. No hidden feature flag is introduced.
- **Existing search:** current `search.query` contract, repository semantics, route destinations and tests remain unchanged while its files move into layers.
- **Exemplary code:** new files start below 250 lines, functions target 50 lines/cognitive complexity below 10, pure layers use readonly/const/no mutation, and no ESLint exemptions or archaeology comments are added.

### 13. Keep observability bounded and private

Record request outcome, retrieval mode, bounded candidate counts, cache hit/miss, repair counts, latency, provider/model and token usage. Do not label metrics or log events with questions, content, prompts, embeddings, answers, user/report/entity IDs or names. Existing correlation/CLS and service logger patterns remain the infrastructure adapters.

## Risks / Trade-offs

- **[PostgreSQL image/extension change affects every environment]** -> Keep PostgreSQL major version 15, update all compose files together, verify existing volumes in a disposable clone, add extension before the table, and never reset production.
- **[Required Mistral config can prevent API boot]** -> Add and validate every non-secret env in all tracked environments and provision secrets before deploying the consuming code; fail-fast is intentional.
- **[Report content leaves the application boundary]** -> Production release requires an approved paid-workspace privacy posture, training-control evidence, approved endpoint/data region and an explicit retention/ZDR decision; do not use Labs models.
- **[Mistral outage makes Chat unavailable]** -> Map provider errors explicitly, bound timeouts, and keep all report writes and existing search independent.
- **[Fresh drafts temporarily lack embeddings]** -> Content hashes plus bounded read-through provide immediate correctness for small gaps; larger gaps return pending rather than biased results.
- **[Current ACL can remove historical visibility]** -> This intentionally matches existing Lead cross-author policy; specs and tests make the current-assignment behavior explicit.
- **[Exact entity resolution asks more clarifying questions]** -> Prefer safe clarification over a fuzzy but potentially cross-scope match.
- **[No conversation history limits follow-up context]** -> Preserve only the latest independent exchange in authenticated-layout memory; resolution tokens cover its clarification loop, while every new question remains a fresh server request.
- **[Exact vector scan has a scale ceiling]** -> Hard-bound candidate sets and observe latency; evaluate ANN only from measured need and a fixed-dimension migration later.
- **[Content-addressed cache grows with edits/model changes]** -> Rows contain no text and are small relative to reports; retention is deferred until measured growth justifies policy.
- **[Generated answers can still be imperfect]** -> Server-owned aggregates, bounded evidence, prompt-injection treatment, structured output and citation validation reduce but cannot eliminate model quality risk.

## Migration Plan

1. Create shared contracts and schema tests without changing runtime behavior.
2. Behavior-neutrally relocate existing search service/repository into the new internal layers; update the module facade and lint zone while keeping existing tests green.
3. Implement and test pure period resolution, accessible entity resolution, candidate projection/filtering, aggregation and context construction with fake ports.
4. Add live/snapshot repository integration and prove ACL/source parity against PostgreSQL fixtures.
5. Update all PostgreSQL images, add `CREATE EXTENSION vector`, the Prisma model/check/unique constraint and repository integration tests. Regenerate Prisma. Disposable local/test environments apply the repository's edited init migration. If a target database has already recorded that init migration, stop and create an additive forward migration from the same reviewed DDL; never reset production or rely on edited applied history.
6. Add explicit configuration across env schema, compose and E2E fixtures; provision Mistral secret/model values before enabling runtime wiring.
7. Add embedding repository, bounded read-through and BullMQ worker with canonical reload and idempotency tests.
8. Add Mistral adapters and service orchestration behind deterministic test ports; no CI call reaches Mistral.
9. Add the canonical `leadProcedure` router and composition-root wiring.
10. Add the right-side Lead Chat Sheet beside Agent review, behavioral tests, accessibility states and E2E catalog coverage for the existing Lead report route.
11. Produce and rehearse a production runbook covering backup, pgvector image compatibility, direct (non-PgBouncer) migration, secrets/config preflight, Mistral model/region/privacy checks, port-443 egress, health/smoke checks and application rollback without removing the extension.
12. Run shared/API/web unit, integration, E2E, Markdown, typecheck, lint and build gates; live-boot from source with complete config.

Rollback application code independently; canonical report data has no assistant dependency. The embedding table can remain inert on rollback. Database removal, if desired, is a separate reviewed migration. Dev/test reset may rebuild the edited init migration; production data is never reset.

## Owner approval gates

- Approve retaining the selected `mistral-medium-3-5` for both planner and answer after UAT, or approve the lower-cost `mistral-small-2603` only after the same evaluation suite passes.
- Approve or adjust the initial `0.55` similarity threshold and server budgets from measured Russian/English queries. The values above are explicit starting settings, not hidden defaults.
- Approve the production Mistral workspace plan, training posture, API retention/ZDR posture and EU data region before any real report content is sent.
