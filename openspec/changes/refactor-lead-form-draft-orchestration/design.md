## Context

`apps/web/src/features/report-sections/ui/lead-form.tsx` is 2117 lines after
the previous slices. Its current responsibilities include route/query setup,
foreign-content visibility, draft mirror state, optimistic-lock version state,
autosave baseline setup, stale-version conflict handling, submit/fill-from
version reads, record merge handlers, and all rendering.

Before flow:

`LeadForm` loads `leadForm.byPeriod` -> computes `sectionToDraftPayload` ->
stores `draftSection` + `version` + refs inline -> calls
`useLeadFormAutosave` inline -> submit/fill-from read `versionRef.current`
inline.

After flow:

`LeadForm` loads `leadForm.byPeriod` -> passes the server section, read-only
state, action section id, and conflict refetch to
`useLeadFormDraftOrchestration` -> receives `draftSection`, `setDraftSection`,
`draftPayload`, `autosave`, `isSubmitted`, `setIsSubmitted`, `version`,
`versionRef`, and `setVersionSafe`. Rendering and record merge handlers stay in
`LeadForm`.

Load-bearing invariants:

- Period dual-state: not touched; no API or database writes change shape.
- Role-coverage gate: not touched; no tRPC procedure or middleware changes.
- Deferred-feature pattern: not touched.
- Published lineage/stableId preservation: preserved by continuing to use
  `sectionToDraftPayload` and existing server guards.

## Goals / Non-Goals

**Goals:**

- Make draft mirror, server reseed, autosave baseline, conflict refetch, and
  optimistic-lock version ownership testable outside the 2117-line component.
- Preserve every current write guardrail: version-only refetches update the next
  write version without dirtying the form; autosave-confirmed versions reach
  submit/fill-from; stale-version conflicts refetch and show the reload toast.
- Reduce `lead-form.tsx` by a meaningful, reviewable slice without changing
  product behavior.

**Non-Goals:**

- No `ReportDataCoordinator` or `FormStateManager`; the backlog explicitly
  defers those to a future grilled change.
- No extraction of item/risk/decision merge handlers.
- No route/query consolidation, foreign-content visibility rewrite, or UI layout
  change.
- No backend, schema, tRPC, or database change.

## Decisions

### D1: Extract a feature-local React hook, not a pure model helper

The boundary needs React state/effects, `useLeadFormAutosave`, conflict refetch,
and toast behavior. A pure model helper would only move `sectionToDraftPayload`
style projection and leave the hard part in `LeadForm`. The hook belongs under
`apps/web/src/features/report-sections/ui/` because it is form UI orchestration,
not a shared domain model.

Alternative rejected: move this into `model/`. That would either import UI hooks
from model (wrong direction) or split the behavior into pieces too small to be
the tested boundary.

### D2: Keep record merge handlers in `LeadForm`

The merge handlers are coupled to the rendered section widgets and foreign-row
filtering. Moving them in this slice would mix two refactors: draft lifecycle
and record editing semantics. They stay where they are and continue to call
`setDraftSection`.

Alternative rejected: extract all form state at once. That recreates the
deferred `FormStateManager` under a different name and makes review harder.

### D3: Characterize before extraction

The first implementation task must verify existing coverage and add any missing
characterization before moving code. At minimum the slice must pin:
version-only refetch behavior, autosave version propagation, conflict refetch
toast, submitted/read-only autosave disablement, and stable draft payload
round-trip.

Alternative rejected: rely only on full `LeadForm` snapshots. Snapshots do not
prove the optimistic-lock or autosave dirty-state contracts.

### D4: Submit and fill-from consume the hook's version API

The hook owns the current version state/ref and exposes `versionRef` plus
`setVersionSafe` for the existing mutations. Submit and fill-from remain in
`LeadForm` for now, but they must keep reading the current version synchronously
from the hook-owned ref.

Alternative rejected: move submit/fill-from mutations into the hook in this
slice. That would also pull confirmation dialogs, reopen/revoke state, and
toolbar disabling into the hook, expanding the boundary too far.

## Risks / Trade-offs

- Refetch reseed regression -> Pin with tests that a server object reference
  change for the same payload does not wipe dirty local edits.
- Version stale-closure regression -> Keep and run the existing guardrail tests
  for autosave bump -> submit and refetch-only bump -> next write.
- Hook API becomes a dumping ground -> Only export draft/version/autosave fields
  and the minimal setters needed by existing merge handlers and mutations.
- Line reduction is modest -> Acceptable; this is a durable boundary slice, not
  a cosmetic line-count pass.

## Migration Plan

1. Add/confirm characterization tests while the behavior is still inline.
2. Extract `useLeadFormDraftOrchestration` with the same logic and no new
   product strings.
3. Rewire `LeadForm` to consume the hook, leaving rendering and merge handlers
   intact.
4. Run focused tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, and `openspec validate refactor-lead-form-draft-orchestration
--strict`.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None for this slice. A later slice must separately grill the broader
  `FormStateManager` / coordinator boundary before building it.
