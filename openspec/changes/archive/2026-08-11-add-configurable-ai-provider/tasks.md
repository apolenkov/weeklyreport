## 1. Shared Contracts and Data Model

- [x] 1.1 Add strict shared Zod schemas and inferred types for provider profiles, redacted configuration reads, draft writes, capability-test results, activation progress, availability, and the `ai_not_configured` assistant outcome.
- [x] 1.2 Add shared contract tests covering unknown fields, custom endpoint/model inputs, masked credential output, lifecycle transitions, progress bounds, and assistant outcome compatibility.
- [x] 1.3 Add Prisma enums/models for immutable `AiProviderConfiguration` revisions and the `AiProviderControl` singleton, including lifecycle, encrypted credential metadata, active-pointer relations, progress fields, and audit-safe timestamps.
- [x] 1.4 Change `SemanticEmbedding` identity to include stable endpoint identity and dimensions, and update the schema plus single init migration so old and candidate scopes can coexist with the vector-dimension CHECK intact.
- [x] 1.5 Update seeds and database tests for unconfigured, bootstrapped-active, disabled, preparing, failed, and superseded configuration states using disposable MVP databases.
- [x] 1.6 Add required, default-free environment validation and fixtures for the encryption key, key version, and allowed provider origins; separate one-shot legacy Mistral bootstrap inputs from normal runtime configuration.

## 2. API Configuration Control Plane

- [x] 2.1 Implement and unit-test an authenticated-encryption codec that validates key material, encrypts/decrypts credentials, detects tampering, supports an explicit key version, and exposes only safe masked metadata.
- [x] 2.2 Implement and unit-test provider profile resolution and URL policy enforcement for fixed Mistral/OpenRouter endpoints and allowlisted custom origins, including rejection of user info, query, fragment, redirects, and non-allowlisted targets.
- [x] 2.3 Implement the configuration repository with parsed redacted reads, immutable revision writes, singleton control-row access, progress updates, and transactional active-pointer swaps.
- [x] 2.4 Implement the configuration application service and state machine for draft save, test eligibility, preparation, activation, disable, failure, supersede, and explicit restoration of a retained tested revision.
- [x] 2.5 Add `admin.aiProvider` procedures using the canonical `adminProcedure` for read, save, test, activate, disable, restore, and progress operations; add role-coverage and non-admin denial tests.
- [x] 2.6 Add safe audit events for bootstrap, draft, test, activation request/result, disable, and restoration, with regression tests proving credentials and provider bodies never enter logs or audit payloads.
- [x] 2.7 Add a minimal authenticated AI-availability read and server-side `ai_not_configured` short circuit without exposing provider, endpoint, model, or credential metadata.
- [x] 2.8 Implement and test an explicit idempotent bootstrap operation that imports complete legacy Mistral values only into an empty AI control plane and never becomes a runtime fallback.

## 3. API Provider Runtime

- [x] 3.1 Implement a shared OpenAI-compatible HTTP transport with bounded timeouts, redirects disabled, safe response parsing, normalized usage, and safe retryability/error classification.
- [x] 3.2 Implement capability-based planner and planner-repair adapters that preserve the forced single `search_report_entries` tool, generated JSON Schema, disabled parallel calls, validation, and bounded repair contract.
- [x] 3.3 Implement capability-based answer and citation-repair adapters that preserve strict structured output, usage validation, grounding isolation, citation verification inputs, and safe protocol failures.
- [x] 3.4 Implement the embedding adapter for ordered batch input, finite vectors, measured dimensions, batch/token budgets, query/document parity, and normalized provider failures.
- [x] 3.5 Implement synthetic capability testing for authentication, forced tool calling, structured answers, token usage, batch embeddings, ordering, finiteness, and measured dimensions without sending product data.
- [x] 3.6 Implement `AiRuntimeResolver` to acquire one immutable active revision per operation, cache constructed clients only by revision ID, and resolve exact retained revisions for workers.
- [x] 3.7 Refactor `ReportAssistantService` and `SearchModule` to use one runtime snapshot for planner, answer, embeddings, semantic scope, and telemetry throughout a request; remove boot-time Mistral singleton selection after parity tests pass.
- [x] 3.8 Add Mistral, OpenRouter, and representative custom-compatible contract tests plus negative tests for unsupported tools, structured output, usage, invalid embedding vectors, authentication, and non-retryable responses.

## 4. Semantic Preparation and Atomic Activation

- [x] 4.1 Derive and test the stable non-secret endpoint identity from profile and normalized base URL so credential and generation-model changes preserve embedding reuse while endpoint changes do not.
- [x] 4.2 Update semantic repository queries and integration tests to key/filter by endpoint identity, model, input version, and dimensions and to prove old and staged scopes cannot overwrite or rank each other.
- [x] 4.3 Extend semantic BullMQ payloads and job IDs with configuration revision and complete non-secret scope; make processors resolve that exact revision and reject scope mismatches across activation.
- [x] 4.4 Implement a preparation coordinator that enumerates canonical semantic sources, enqueues bounded jobs, records completed/total/failed/elapsed progress, and safely resumes idempotent work.
- [x] 4.5 Implement final current-hash reconciliation and the atomic activation transaction so changed report content or failed vectors keep the old pointer active, while an unchanged embedding scope skips rebuilding.
- [x] 4.6 Add concurrency and integration tests for edits during preparation, activation with queued old jobs, failed preparation, credential-only rotation, manual restoration, multi-instance active resolution, and uninterrupted report writes/period dual-state.

## 5. Web Administration and Availability UX

- [x] 5.1 Replace the Settings → Integrations AI `ComingSoonBadge` card with an admin form for Mistral, OpenRouter, and custom OpenAI-compatible profiles, conditional endpoint input, three model roles, and masked credential replacement. Determine embedding dimensions from the synthetic capability response rather than an admin-supplied field.
- [x] 5.2 Add test, activate, disable, and restore controls with confirmation, accessible busy/error/success states, and exact preparation counts plus elapsed time without a fabricated ETA.
- [x] 5.3 Keep the current active configuration visibly distinguished from draft/preparing/failed revisions and explain that the old configuration serves everyone until atomic activation.
- [x] 5.4 Wire the Lead toolbar to minimal AI availability so Chat remains visible but disabled with English explanatory copy when unconfigured, while existing non-Lead authorization remains unchanged.
- [x] 5.5 Add Testing Library coverage for provider-specific fields, secret masking, unsafe input errors, capability failure, preparation progress, activation, disable/restore, and Lead configured/unconfigured states.
- [x] 5.6 Update the relevant E2E catalog scenarios for the live Integrations controls and add integration coverage for the admin-only global workflow without introducing a new route.

## 6. Rollout, Operations, and Documentation

- [x] 6.1 Update `.env.example`, Docker/runtime environment wiring, test fixtures, and deployment manifests with explicit encryption, allowlist, operational, and one-shot bootstrap values and no product-config defaults.
- [x] 6.2 Update assistant prompt/runbook documentation and operational checks from Mistral-specific wording to active-provider capability, privacy, retention/ZDR, region, destination, and model-availability requirements.
- [x] 6.3 Add safe metrics for configuration state, capability-test outcomes, preparation counts/duration, activation results, and runtime provider profile/model labels without endpoint, secret, prompt, report, or user data.
- [x] 6.4 Exercise the bootstrap and disposable database reset path, document the non-disposable additive-migration contingency, and verify rollback/restoration without deleting retained configuration or cache scopes.
- [x] 6.5 Remove the AI `ComingSoonBadge` and legacy runtime `MISTRAL_*` dependency only after the database-backed Mistral bootstrap and end-to-end workflow pass in every target environment.
- [x] 6.6 Review every changed AI write path against `ai-provider-configuration`, `lead-report-assistant`, `semantic-embedding-cache`, and `lead-assistant-provider-resilience`, and preserve the canonical role chain, period dual-state, destructive guard, and report-write independence.

## 7. Verification

- [x] 7.1 Run focused shared, API, web, Prisma, transport-contract, semantic repository, BullMQ, and admin/Lead UI tests for the changed paths.
- [x] 7.2 Run `pnpm --filter @customreport/api db:generate` and verify generated Prisma types before the full gates.
- [x] 7.3 Run `pnpm catalog:check` and `pnpm test:e2e:integration` against a distinct disposable E2E database.
- [x] 7.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and the repository's Markdown formatting gate; record the exact commands and results before marking the change complete.

### Verification record

- `pnpm --filter @customreport/api db:generate` — passed.
- `pnpm typecheck` — passed (5/5 tasks).
- `pnpm lint` — passed (ESLint, Stylelint, Prisma typecheck, status-literal, Playwright image sync, dependency-cruiser, Knip; Knip emitted one existing configuration hint).
- `pnpm test` — passed (API 200 files / 1,925 tests; web 219 files / 2,044 tests; Prisma 5 files / 16 tests).
- `pnpm build` — passed (5/5 tasks).
- `pnpm format:check` — passed; this repository intentionally has no `pnpm lint:md` script because Markdown is formatted, not linted.
- `pnpm catalog:check` — passed with no route drift.
- `pnpm test:e2e:integration` — passed (51 tests) against disposable `customreport_e2e`.
- `openspec validate add-configurable-ai-provider` — passed.
