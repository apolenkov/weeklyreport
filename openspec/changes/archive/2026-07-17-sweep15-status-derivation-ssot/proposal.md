## Why

Legacy stage aliases can produce different report health on write and read surfaces, so the same report may appear green in one place and red in another. The P1-1/P1-2 findings in `docs/reviews/2026-07-15-external-sweep.md` identify duplicated stage matching and traffic aggregation as the shared cause.

## What Changes

- Add shared `riskCoversStage` behavior based on `stageNamesMatch`, and delete the API repository and web alias/matcher copies.
- Canonicalize legacy stage names during API status derivation before applying risk floors.
- Add one API domain `aggregateTrafficLight` helper and use it in both `mergeSection` and the read-model status derivation.
- Collapse the read derivation's private severity rank/worst-of operations into that helper where their inputs are traffic-light values.
- Remove `"use client"` from pure stage-name helpers.
- Add alias and read/write parity regression tests.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `status-risk-unification`: risk coverage and aggregate health use one canonical stage matcher and one API aggregation seam across read and write paths.

## Impact

- Shared: `packages/shared/src/schemas/stage-names.ts` and exports/tests.
- API: lead-form repository coverage checks, report-section merge, status derivation, mappers, and focused tests.
- Web: report-section stage helpers and their consumers/tests.
- No schema, tRPC, role, or period dual-state changes.

## Non-goals

- Consolidating unrelated web ranks in `sdlc-pipeline-health.ts`, `activity-status-section.tsx`, `weekly-report.ts`, `slide-grid-cells.ts`, `section-slide-utils.ts`, or `lead-form-draft-merge-helpers.ts`; those belong to `sweep15-simplify-dedup`.
- Changing risk severity, empty-stage, activity, or persistence semantics.
