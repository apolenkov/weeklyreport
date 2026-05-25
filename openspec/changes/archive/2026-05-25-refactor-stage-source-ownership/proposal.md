# Refactor stage source ownership

## Problem

Stage-name mapping is duplicated in two locations, creating a maintenance
burden and sync risk:

1. `apps/web/src/lib/mappers/lead-form.ts:296` — `getStageSelectOptions()`
   maps stage codes to labels.
2. `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:764`
   — identical mapping in the persistence layer.

When the stage enum changes, both must be updated. The web layer also has a
TODO(v8.5-C-ownership) marker noting "this function is one of TWO sources of
stage".

## Solution

Consolidate the mapping into a single canonical source:

- Move the mapping to `packages/shared/src/lib/stage-mapping.ts` (or extend an
  existing shared enum module).
- Export `stageCodeToLabel()` and `stageLabels` from the shared package.
- Update both web and API consumers to import from the shared source.
- Remove the TODO marker and verify both surfaces use identical logic.

## Non-goals

- Change the stage enum itself or the Prisma schema.
- Refactor stage logic in report queries.
- Touch the slide-deck or head-role surfaces.

## Source

- TODO(v8.5-C-ownership) marker at `lead-form.ts:296`.
- Deepscan finding: duplicate stage mapping detected in Phase 43 codebase audit.

## Activation trigger

(Active — identified in current PRJ-2 phase, needed for v8.5.)
