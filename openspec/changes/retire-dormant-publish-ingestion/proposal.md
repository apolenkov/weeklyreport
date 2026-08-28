## Why

WeeklyReport cannot boot its API composition in production because both publish paths promise an ingestion outcome that the MVP does not provide. The only consumer belongs to the explicitly deferred AI/RAG proposal, while `period.module.ts`, `publication.module.ts`, `publish-side-effects.ts`, and `docs/sdlc.md` currently preserve a loud no-op seam as a release blocker.

## What Changes

- Retire publish-time ingestion from the current MVP contract instead of inventing a queue or consumer with no owned product outcome.
- Remove `IngestionPublishHook`, `PublicationIngestionQueue`, `NoopIngestionQueue`, section-id reads used only for ingestion, ingestion error plumbing, and the two production boot guards.
- Keep manual and automatic publish compare-and-set behavior, telemetry, analytics-cache invalidation, audit behavior, and post-commit failure isolation unchanged.
- Keep AI/RAG deferred. A future activation must introduce its own explicit product contract and integration architecture; it cannot depend on this dormant seam.
- Update SDLC and durable publish requirements so production readiness describes the implemented MVP rather than a placeholder integration.

Non-goals:

- Selecting or implementing an AI provider, embeddings, a vector store, or report summaries.
- Changing publish authorization, state transitions, snapshots, audit events, metrics, cache behavior, or API responses.
- Adding a replacement background queue, runtime flag, browser harness, or compatibility shim.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `publish-compare-and-set`: Post-publish side effects are telemetry and analytics-cache invalidation only; ingestion is not part of the current publish contract.
- `period-scheduler-wiring`: Mandatory service dependencies retain product-owned policy and cache ports but no longer include the ingestion-only section-id reader.

## Impact

Affected code is limited to the period/publication application services and Nest composition, their colocated unit tests, the durable publish specification, deferred AI/RAG planning references, and first-production documentation. No schema, migration, tRPC contract, dependency, or external system changes.
