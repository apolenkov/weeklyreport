## 1. API Publish Architecture

- [x] 1.1 Simplify the shared post-publish side-effect helper to telemetry plus analytics-cache invalidation, remove all ingestion ports/callbacks/section-id inputs, and verify its focused unit tests cover independent post-commit failure isolation.
- [x] 1.2 Remove manual-publish ingestion wiring, ingestion-only repository reads, logging, and the production boot guard from the period service/module; verify manual publish CAS, telemetry, cache, authorization, and production-shaped module tests pass.
- [x] 1.3 Remove `PublicationIngestionQueue`, `NoopIngestionQueue`, automatic-publish ingestion calls, and their module providers; verify auto-publish write/skip/audit/telemetry/cache tests pass without an ingestion collaborator.

## 2. Durable Product Contract

- [x] 2.1 Update ingestion-specific colocated tests without weakening publish transition assertions, then prove repository search has no live `IngestionPublishHook`, `PublicationIngestionQueue`, `NoopIngestionQueue`, `ingestionHook`, or `TODO(ingestion-consumer)` reference.
- [x] 2.2 Reconcile the durable publish spec, first-production SDLC checklist, deferred AI/RAG proposal, and active preproduction change so they explicitly retire ingestion for the MVP; verify affected and all OpenSpec items validate strictly.

## 3. Verification And Checkpoint

- [x] 3.1 Run the focused period/publication Vitest suites, `pnpm typecheck`, full non-fail-fast `pnpm lint`, `pnpm test`, `API_URL=http://localhost:3002 NEXT_PUBLIC_API_URL=http://localhost:3002 pnpm build`, `pnpm format:check`, and `pnpm exec openspec validate --all --strict`; record every exit.
- [x] 3.2 Commit the atomic product change, prove a clean exact branch/HEAD/tree, and report local checkpoint separately from remote/CI state without starting browser, runtime-campaign, mobile, database, Redis, or container work.
