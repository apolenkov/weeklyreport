## Context

Three stage-name matchers currently disagree on alias handling, while API write aggregation (`domain/report-section-merge.ts`) and read aggregation (`infrastructure/report-sections.status-derivation.ts`) each own severity precedence. The change crosses shared, API domain/infrastructure, and web helper boundaries.

## Goals / Non-Goals

**Goals:** one shared stage-coverage predicate; one API domain traffic aggregation primitive; identical `Dev`/`Development` behavior on write and read.

**Non-Goals:** a repo-wide status-rank cleanup or any change to stored status semantics.

## Decisions

### Shared coverage owns name equivalence

`packages/shared/src/schemas/stage-names.ts` will export `riskCoversStage(record, stageName)`. Populated `stageIds` compare through `stageNamesMatch`; an empty array covers all; absent `stageIds` falls back to legacy CSV tags using the same matcher. Web `stage-tags.ts` may retain display splitting/canonical-label helpers but not its own alias map or coverage predicate, and it no longer needs `"use client"`.

Before: repository normalization, web canonicalization, and API raw `includes` can disagree. After: every coverage edge delegates name equality to `stageNamesMatch`.

### API domain aggregation accepts values, not infrastructure rows

A pure `aggregateTrafficLight(statuses)` helper will live under the report-sections domain and return `red > yellow > green > null`. The write merge maps owned-stage statuses into it. The read derivation uses it for stage aggregation, risk floors, raw product floors, and activity floors instead of its private rank/worse functions.

This keeps Prisma/read-model shapes outside the domain helper and makes both API flows depend on one precedence definition:

`write payload -> mergeSection -> aggregateTrafficLight -> read model`

`Prisma mapper -> risk-aware derivation -> aggregateTrafficLight -> read model`

### Remaining web ranks stay explicit

Ranks using different vocabularies or presentation-local folds are not pulled across the API boundary. The proposal lists every known remainder for `sweep15-simplify-dedup`.

## Risks / Trade-offs

- Alias regression in legacy CSV parsing → port existing web cases to shared tests and add API published/read parity coverage.
- A generic helper could hide empty semantics → include `null` and empty-array cases in the domain tests.
- Import-cycle risk → keep the domain helper dependency-free except shared types.

## Invariants

Period dual-state, role-coverage, destructive-db guard, and deferred-feature behavior are preserved; no write lifecycle, procedure, or schema changes.
