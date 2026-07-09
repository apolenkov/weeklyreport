## Context

`apps/web/src/features/report-sections/ui/lead-form.tsx` is 1858 lines after
`refactor-lead-form-write-actions`. Draft orchestration and write actions are
already isolated, but the component still owns the edit-side merge layer:

Before flow:

`LeadForm` maps the loaded draft -> child sections emit presentation rows ->
inline handlers merge product status, activity status, items, risks, decisions,
move actions, blocker routing, and quick-add saves back into `draftSection` ->
autosave serializes that draft.

After flow:

`LeadForm` maps the loaded draft -> child sections call handlers returned by a
feature-local draft-merge boundary -> the boundary updates `draftSection` using
tested pure helpers and exposes the same add-signal/prefill/quick-add state ->
autosave sees the same draft shape.

Load-bearing invariants:

- Period dual-state: preserved; no API, service, repository, or database write
  changes.
- Role-coverage gate: preserved; no tRPC procedure or middleware changes.
- Deferred-feature pattern: not touched.
- Published-lineage identity: preserved; move actions update existing draft rows
  by id and must not delete/recreate records.

## Goals / Non-Goals

**Goals:**

- Move product, activity, item, risk, decision, move-action, blocker-routing,
  and quick-add draft edit commands out of `LeadForm`.
- Keep the extracted boundary feature-local and reviewable.
- Preserve activity-parent XOR fields, foreign-row stripping, paused reason
  clearing, priority ranks, stage status aggregation, and published-lineage
  stable identity.
- Add characterization tests before moving code for the risky merge paths.
- Update `architecture-refactor-backlog` with actual post-slice LOC evidence.

**Non-Goals:**

- No route/query/session/visibility extraction.
- No render component or layout extraction.
- No backend, shared schema, Prisma, or tRPC procedure changes.
- No new form coordinator object spanning draft, write actions, routing, and
  rendering.

## Decisions

### D1: Extract a feature-local hook plus pure merge helpers

The boundary needs React state for add signals, risk prefill, and quick-add item
host state, so a pure helper-only move would leave command orchestration in
`LeadForm`. The pure helpers still matter: they make the raw merge semantics
unit-testable without rendering the whole form.

Alternative rejected: move all logic into `model/lead-form.ts`. That module
already maps server read models to presentation data; importing UI command state
or `setDraftSection` semantics there would blur the model/UI boundary.

### D2: Use a lazy loaded-context ref for post-load data

`LeadForm` has an early skeleton return. Custom hooks must run before that
return, but values such as `products`, displayed item lists, and `ownRisks` only
exist after mapping the loaded draft. The hook should therefore receive a
`getLoadedContext` callback backed by a ref that `LeadForm` refreshes after the
mapping block.

Alternative rejected: call the hook after the skeleton return. That would break
React hook order across loading and loaded renders.

### D3: Do not combine this with render extraction

The render tree is large, but this slice is about preserving write-side draft
semantics. Moving JSX in the same change would increase review noise and make a
merge regression harder to isolate.

Alternative rejected: create a broad `LeadFormContent` component now. It would
reduce lines quickly but leave the dangerous merge layer spread across two
components.

## Risks / Trade-offs

- Activity-parent rows lose XOR fields -> Add tests that change activity-parented
  item/risk/decision rows and assert `activityId` survives while product/stage
  fields clear correctly.
- Foreign read-only rows leak into autosave -> Add tests that pass `.foreign`
  rows through item/risk/decision change handlers and assert they are stripped.
- Published record identity breaks on move actions -> Keep move/complete/pause
  paths as id-based patch updates and assert stableId/preserved fields survive.
- Hook grows beyond the 250-line standard -> Split raw merge helpers into a
  separate feature-local module if needed; do not add a new lint exemption.
- Characterization through the full form is slow -> Prefer pure helper tests for
  merge semantics plus one focused `LeadForm` integration test for quick-add
  routing where DOM behavior matters.

## Migration Plan

1. Add characterization tests for current merge behavior before extraction.
2. Add pure helper module and `useLeadFormDraftMerges` under the feature UI
   folder, keeping both files under the 250-line standard.
3. Rewire `LeadForm` to consume the returned handlers/signals while leaving
   query/routing/visibility/render behavior unchanged.
4. Update `architecture-refactor-backlog` and matching delta with post-slice
   LOC evidence.
5. Run focused tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm format:check`, `git diff --check`, and OpenSpec
   validation.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking. If the hook cannot stay under 250 lines with readable code,
  split additional pure helpers rather than weakening the lint standard.
