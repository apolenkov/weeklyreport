## 1. Shared planner contract

- [x] 1.1 Replace the exhaustive SearchPlan wire schema with a compact conditional schema that retains periods, authors, subjects, stages, record kinds, filters, retrieval, grouping, limits, and exhaustive intent.
- [x] 1.2 Add normalization and focused tests for current-week tasks, previous-week blockers, author-scoped work, named periods, semantic queries, aggregates, and rejected internal controls.

## 2. API runtime protocols

- [x] 2.1 Reduce the OpenAI-compatible planner adapter to one forced `search_report_entries` tool request plus at most one same-protocol retry, with no strict-schema fallback.
- [x] 2.2 Change the answer adapter and prompt contract to use a minimal JSON Object Mode envelope, retaining allowlist validation and at most one same-protocol citation repair.
- [x] 2.3 Resolve versioned code-owned prompt constants with the active provider and remove stored prompt revision/evaluation state from runtime availability.
- [x] 2.4 Bound provider throttling retries by the synchronous request budget and surface safe rate-limit feedback without a client-side connection error.

## 3. Provider lifecycle

- [x] 3.1 Narrow blocking capability testing to generation, planner tool, JSON Object Mode answer, usage, and embedding smoke checks.
- [x] 3.2 Decouple product-quality synthetic evaluation and stored prompt evaluation from provider validation, activation, and availability.

## 4. Web administration

- [x] 4.1 Present connection/protocol readiness separately from optional quality diagnostics and state that stored prompt revisions do not control runtime.

## 5. Verification

- [x] 5.1 Run focused shared, planner, answer, provider, runtime, service, and web tests.
- [x] 5.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm lint:md`.
- [x] 5.3 Run a live Groq `qwen/qwen3.6-27b` plus Jina `jina-embeddings-v5-text-small` flow from draft save through activation and one report-assistant answer without exposing credentials.
