## Context

See `proposal.md` for motivation. Manual publish and scheduler auto-publish already share `emitPublishSideEffects`, but that helper also owns a deferred ingestion hook. Manual composition rejects every production boot because no consumer is wired; automatic composition injects a warning-only `NoopIngestionQueue` that also rejects production. The deferred AI/RAG proposal is the only planned consumer and has no selected provider or active milestone.

The period dual-state transition, role-coverage gate, and destructive-database guard are unchanged. The deferred-feature pattern remains intact: AI/RAG stays visibly deferred and receives no hidden backend path.

## Goals / Non-Goals

**Goals:**

- Make the current production composition describe only implemented MVP behavior.
- Keep one shared, independently guarded post-commit side-effect sequence.
- Remove dead ports, reads, logs, and tests rather than replacing them with a compatibility layer.

**Non-Goals:**

- Change either publish transaction, authorization, API shape, scheduler selection, audit, telemetry labels, or cache policy.
- Establish an extension point for an unknown future AI/RAG architecture.

## Decisions

### Remove ingestion from the shared side-effect contract

Before:

`publish transition -> telemetry -> analytics cache -> section-id read -> ingestion hook/no-op`

After:

`publish transition -> telemetry -> analytics cache`

Telemetry and cache invalidation remain separate guarded operations. The helper no longer accepts `getSectionIds`, ingestion callbacks, or empty-section policy because none has a current product consumer.

Alternative considered: keep an optional hook. Rejected because an optional or no-op hook preserves an architectural promise with no owner, hides dead behavior, and keeps tests coupled to a deferred feature.

### Remove composition guards instead of replacing the consumer

`PeriodModule` and `PublicationModule` will stop injecting environment and ingestion collaborators for publishing. This makes production module resolution honest without adding a queue, feature flag, or runtime branch.

The `period-scheduler-wiring` contract is renamed narrowly because its current mandatory-dependency requirement also names the ingestion-only `listSectionIds` port. Scheduler audit, reopen-policy, and cache invalidation remain mandatory; only the speculative repository read is retired.

Alternative considered: implement a generic BullMQ ingestion job. Rejected because job payload, durability, retry policy, data ownership, and consumer outcome are undefined until the AI/RAG feature is activated.

### Require future AI/RAG activation to own a new integration

The deferred proposal will no longer cite a pre-existing publish hook. A future change may add an outbox, domain event, or direct queue only after defining consistency, retry, privacy, and retention requirements. This avoids freezing today’s synchronous post-commit shape as tomorrow’s architecture.

## Risks / Trade-offs

- [Future AI activation needs a new publish integration] -> The deferred change explicitly owns that design and migration; current product code stays free of speculative coupling.
- [Removing section-id reads could hide an accidental consumer] -> Repository-wide symbol search and TypeScript/Knip checks must prove no live consumer remains.
- [A broad test rewrite could mask publish behavior] -> Delete only ingestion-specific assertions and keep existing CAS, telemetry, cache, audit, and failure-isolation assertions green.

## Migration Plan

No data or deployment migration is required. Land the code/spec removal atomically, build with explicit production API URLs, and verify production-shaped Nest module resolution. Rollback is the single Git revert of this change; it restores the previous boot guards and no-op seam without touching persisted data.
