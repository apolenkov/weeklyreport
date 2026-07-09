## Context

`apps/web/src/features/report-sections/ui/lead-form.tsx` is 1485 lines after
`refactor-lead-form-draft-merges`. Query setup, draft orchestration, write
actions, and draft merge commands are now split, but the loaded render path still
builds a large display model inline after the skeleton guard.

Before flow:

`LeadForm` loads queries -> maps `draftSection` through `mapLeadFormData` ->
derives cross-author products, own/foreign item/risk/decision rows, activity
alarms, priority ranks, published-lineage lock sets, fill-from lock state,
unified entries, visible periods, current user, and read-only state inline ->
renders sections.

After flow:

`LeadForm` loads queries -> calls a feature-local loaded-view-model boundary
with the already-loaded query/draft inputs -> receives the same display arrays
and affordance values -> renders the existing JSX unchanged.

Load-bearing invariants:

- Period dual-state: preserved; no API, service, repository, or database write
  changes.
- Role-coverage gate: preserved; no tRPC procedure or middleware changes.
- Deferred-feature pattern: preserved; no deferred controls change.
- Published-lineage identity: preserved; lock sets stay derived from raw
  `stableId` lineage, not presentation row order.

## Goals / Non-Goals

**Goals:**

- Move loaded display derivations out of `LeadForm` into a tested feature-local
  boundary.
- Preserve Everyone/Mine gating, foreign full-content display merges, own-only
  submit/write context, activity alarm floors, unified activity buckets,
  published-lineage locks, visible-period filtering, and read-only derivation.
- Keep the boundary narrow: loaded inputs in, display model out.
- Update `architecture-refactor-backlog` with actual post-slice LOC evidence.

**Non-Goals:**

- No query/routing/session/visibility extraction.
- No draft orchestration, write-action, or draft-merge changes.
- No render component extraction, layout restructuring, or styling changes.
- No backend, shared schema, Prisma, tRPC procedure, route, or UI-string changes.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Decisions

### D1: Extract a pure builder with a small hook-free boundary

The derivations already run only after the skeleton guard, so the boundary does
not need React state or effects. A pure builder can accept loaded inputs and
return display values, making foreign-row gating, lock derivation, period
filtering, and unified-entry bucketing cheap to characterize.

Alternative rejected: a `useLeadFormLoadedViewModel` hook. A hook adds little
value here and risks obscuring that this slice is pure projection, not lifecycle
state.

### D2: Keep query/cache purge and routing in `LeadForm`

The cache-purge effects, canonical redirects, role redirects, and query error
handlers depend on hook ordering and route/session lifecycle. Moving them in
this slice would mix data loading concerns with display projection.

Alternative rejected: extract a broad data-loading coordinator now. That is a
separate architectural step and would make regressions hard to isolate.

### D3: Preserve JSX call sites while replacing local variables

This slice should reduce logic density, not churn the UI tree. `LeadForm` should
continue rendering the existing sections and dialogs, but read values from the
loaded view model instead of recomputing them inline.

Alternative rejected: extract `LeadFormContent` now. It would reduce line count
quickly, but it would move a large JSX surface before the loaded derivations are
independently tested.

## Risks / Trade-offs

- Foreign rows leak into write context -> Characterize that `ownRisks`,
  `ownCurrentWeekItems`, `ownNextWeekItems`, and `ownDecisions` stay separate
  from displayed Everyone rows.
- Everyone/Mine gating regresses -> Test that full-content rows appear only when
  visibility is hydrated, Everyone is selected, and the slides deck is own.
- Published records become editable -> Test lock sets derive from raw
  `publishedLineage` stable IDs and raw draft rows.
- Unified activity bucketing changes -> Test own rows use raw item workflow
  fields while foreign rows fall back to presentation status.
- Boundary grows past 250 lines -> Split pure helpers before adding any lint
  exemption.

## Migration Plan

1. Add characterization tests for the loaded view-model derivations.
2. Add the feature-local pure builder under
   `apps/web/src/features/report-sections/ui/`.
3. Rewire `LeadForm` to consume the builder result while leaving query/routing,
   orchestration hooks, and JSX behavior unchanged.
4. Update the backlog spec and delta with actual post-slice LOC evidence.
5. Run focused tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm format:check`, `git diff --check`, and OpenSpec
   validation.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking. If the pure builder becomes too wide, split helper functions
  by derivation family instead of weakening max-lines.
