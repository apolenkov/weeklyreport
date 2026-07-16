## Why

The repository-level publish compare-and-set is already unified (`publish-compare-and-set` spec), but the service layer above it still duplicates everything around it: `PeriodService.publishPeriod` and `PublicationService.publishReport`/`publishAuto` each hand-implement the same post-publish side-effect discipline (telemetry pair emitted only after a real transition, ingestion enqueue with swallowed errors, identical near-verbatim comments) and each declares its OWN `IngestionPublishHook` type. On top of that, `review.publish` (→ `publishReport`) has zero web callers — every head surface publishes through `period.publish` — so one of the two manual publish entry points is dead product surface kept alive only by its own API test.

## What Changes

- Extract one post-publish side-effect module (telemetry pair + ingestion enqueue + analytics-cache invalidation, with the emit-only-after-real-transition discipline) used by both `PeriodService.publishPeriod` and `PublicationService.publishAuto`.
- Collapse the two `IngestionPublishHook` declarations into one shared type at the new module's seam.
- Delete the dead manual path: `review.publish` tRPC mutation and `PublicationService.publishReport`, plus their dedicated tests. `PublicationService` keeps its real concerns: assembled-report reads and scheduler-driven `publishAuto`.
- No change to the repository CAS helper, the guarded predicate, zero-row disambiguation, or snapshot strategy — those are pinned by `publish-compare-and-set` and stay exactly as-is.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `publish-compare-and-set`: post-publish side-effects gain a single emission seam; the dead manual publish entry point is removed.

## Impact

- API: `apps/api/src/modules/period/application/period.service.ts`, `apps/api/src/modules/publication/application/publication.service.ts`, `apps/api/src/infrastructure/trpc/routers/review.router.ts`, composition wiring in `period.module.ts`/publication module, `review-publish-target.test.ts`.
- Web: none (no web caller of `review.publish` exists).
- No schema or migration changes. Period dual-state write path untouched (lives below, in the shared CAS helper).

## Non-goals

- Merging `PeriodService` and `PublicationService` — their remaining concerns (lifecycle scheduling vs assembled-report shaping) are legitimately distinct modules.
- Changing publish semantics, outcome classification, or telemetry label vocabulary.
