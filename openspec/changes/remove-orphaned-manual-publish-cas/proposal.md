## Why

Deleting the dead `review.publish` → `publishReport` path (`consolidate-publish-side-effects`) orphaned the manual-publish branch of the publication repository: `PublicationPrismaRepository.publishAssembledReport`, the `PublishReportOutcome` type, and the `PublicationAccessError`/`PublicationArchivedError` classes are no longer reachable from any production caller — they are kept alive only by their own tests and the tRPC error-mapper rows. Dead internal code with live tests reads as covered surface and misleads future readers.

## What Changes

- Delete `PublicationPrismaRepository.publishAssembledReport`, `PublishReportOutcome`, and their tests; `saveAutoPublishedReport` (scheduler path) stays.
- Delete `PublicationAccessError` and `PublicationArchivedError` (no remaining thrower) and their error-mapper rows/tests; `PublicationNotFoundError` stays (thrown by `getAssembledReport`).
- Update the `publish-compare-and-set` spec: the shared CAS helper's mandatory-caller list shrinks to the two live write paths (`PeriodPrismaRepository.publishPeriod`, `PublicationPrismaRepository.saveAutoPublishedReport`).
- Verify by repo-wide grep that nothing else references the deleted symbols before removal.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `publish-compare-and-set`: the shared-helper requirement names the live callers instead of the deleted manual publication path.

## Impact

- API: `apps/api/src/modules/publication/` (repository, service exports, tests), `apps/api/src/infrastructure/trpc/` error-mapper + tests.
- No schema, web, or behavior changes — pure dead-code removal; every deleted symbol must be provably caller-free.

## Non-goals

- Touching `PeriodPrismaRepository.publishPeriod`, the shared CAS helper's internals, or `publishAuto` semantics.
