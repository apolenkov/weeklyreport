## Context

`makeQueryClient` globally assigns `placeholderData: keepPreviousData`. TanStack Query therefore exposes period A as successful placeholder data after navigation changes the query key to period B. Report consumers mostly check `isLoading`, which is false for placeholder data, so content and mutation controls can render under the wrong URL.

## Goals / Non-Goals

**Goals:** make report identity transitions fail closed; retain previous rows only where identity is stable and audited.

**Non-Goals:** redesign skeletons, remove cache reuse for the same query key, or solve the activity fallback gate.

## Decisions

### Choose scoped `keepPreviousData`

The global query default will not provide placeholder data. A query may opt in locally only when all of these are true:

1. the surface is a list/pagination/refetch view rather than one report identity;
2. retained rows cannot enable a mutation against a changed report id; and
3. the consumer is covered by a transition test.

This is chosen over sprinkling `isPlaceholderData || isFetching` gates across report consumers. Central removal makes safe behavior the default and prevents a newly added report surface from silently inheriting the leak. It also avoids hiding stable cached data during a same-key background refetch: only key changes enter a pending state.

Before:

`URL B -> query key B -> placeholder data A -> report B chrome + report A body/actions`

After:

`URL B -> query key B -> pending/skeleton -> data B -> report B body/actions`

### Audit by report identity boundary

Implementation will inventory every `weeklyReport.get`, lead-form/report-by-id, print, head/viewer shell, and slide consumer. Tests must assert both body identity and mutation absence during a deferred B response. Explicit `keepPreviousData` sites will be documented at their query option, not hidden in a helper default.

## Risks / Trade-offs

- More loading transitions on period navigation → preserve normal cache hits and use existing skeletons.
- An unsafe opt-in could recreate the bug → require a local rationale and transition test for each opt-in.
- Shared consumers overlap the slides follow-up → land this change first; rebase the slides gate on its loading semantics.

## Invariants

No API, role, period dual-state, destructive-db, or deferred-feature invariant changes. This is a client cache-presentation boundary only.
