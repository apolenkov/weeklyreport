## 1. Shared Result Contract

- [x] 1.1 Add regression fixtures covering provider-passed/feature-inconclusive and planner `tool_use_failed` outcomes.
- [x] 1.2 Keep the shared three-state capability result strict and bounded while exposing all data required for truthful UI feedback.

## 2. API Reliability and Aggregation

- [x] 2.1 Add transport and planner tests for bounded transient retry and invalid tool-call retry with deterministic settings.
- [x] 2.2 Implement bounded 429/5xx transport retry and Groq-style `tool_use_failed` planner retry without retrying authentication failures.
- [x] 2.3 Classify only HTTP 401/403 as authentication and retain planner/answer failure identity.
- [x] 2.4 Execute feature synthetic probes without an unbounded request burst and preserve inconclusive checks.
- [x] 2.5 Derive test result, lifecycle transition, and durable execution from one three-state provider-plus-feature aggregate.
- [x] 2.6 Negotiate strict JSON-schema planner output after bounded native tool-generation failure and expose a provider-neutral Structured planner capability.
- [x] 2.7 Scope provider-test execution identities and deduplication to one saved revision, with unit and database regression coverage for duplicate fingerprints.
- [x] 2.8 Make strict JSON-schema fallback instructions protocol-consistent and bump the provider evaluator identity so stale evidence is not reused.
- [x] 2.9 Retain unchanged credentials from an explicitly selected inactive base revision, with shared, API, and web regression coverage.
- [x] 2.10 Isolate English/Russian valid-plan checks from the dedicated exact/semantic routing assertions and bump stale evaluator evidence.
- [x] 2.11 Align activation evidence with revision-scoped executions and support idempotent resume after completed preparation.
- [x] 2.12 Make exact passing prompt evidence monotonic, retry non-passing evidence, and activate from the candidate revision's immutable feature snapshot.
- [x] 2.13 Recover legacy-downgraded prompt evidence from an exact passing active revision without reusing cross-revision provider executions.
- [x] 2.14 Create a revision-scoped retry execution when an administrator retests an incompatible revision.

## 3. Web Feedback

- [x] 3.1 Add Provider-card tests for passed provider lanes with inconclusive feature compatibility and for planner tool-call failure identity.
- [x] 3.2 Render feature compatibility separately and replace generic contradictory messages with bounded actionable feedback.
- [x] 3.3 Label newly tested planner evidence by its structured contract rather than claiming native tool-call success.
- [x] 3.4 Prioritize a preparing revision, expose Resume activation, and disable competing Save/Test actions.
- [x] 3.5 Report a completed passing active revision as complete instead of falling through to the incomplete-result message.

## 4. Planning and Verification

- [x] 4.1 Run focused Vitest suites for shared, API capability/compatibility/repository, and web Provider-card behavior.
- [x] 4.2 Run `pnpm typecheck`, changed-file ESLint with `--max-warnings 0`, `pnpm lint:md`, `pnpm test`, and `pnpm build`.
- [x] 4.3 Retest the saved Groq/Jina revision and confirm coherent visible, persisted, and execution outcomes without exposing credentials.
