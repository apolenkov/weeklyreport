## Context

`apps/web/src/features/report-sections/ui/lead-form.tsx` is 1314 lines after
`refactor-lead-form-loaded-view-model`. Draft orchestration, write actions,
draft merges, and loaded display derivations are extracted; the last
load-bearing logic block inside the component is the data-loading layer:

- six queries (`getActive`, `byPeriod`, `myHistory`, `viewSettings`,
  `crossAuthors`, `crossAuthorContent`) with dependent enablement chains;
- record-visibility state and the Everyone/Mine + foreign-deck gating;
- two cache-purge effects (toggle-leave and identity-change — the 7c.6
  security guard);
- two redirect effects (canonical URL, head-away);
- three query error handlers.

This change was council-grilled: two independent advisers (a deep-reasoning
adviser and the Codex-plugin seat) answered the same brief in parallel. Both
agreed on folding the icon/toggle relocation in, on wholesale-object prop
threading for future slices, and on keeping the render-phase ref assignments
in `LeadForm`. They disagreed on ordering: the Codex seat proposed extracting
the JSX tree first (bigger bite), the deep-reasoning seat proposed extracting
the data-loading hook first. Adjudication picked data-loading first: it is the
last logic extraction (all later slices become mechanical JSX splits against a
stable contract), it is atomic (a JSX slice needs 5–7 new files in one change),
and it creates a genuinely testable new boundary. The Codex seat's JSX split
blueprint is recorded as the plan for the next slices. Codex hit its spend cap
during this change's grilling window; the stop-time Codex review gate stays
disabled until the cap resets.

Before flow:

`LeadForm` composes queries, gating, purges, redirects, and error handlers
inline -> feeds the loaded view-model builder and the three extracted hooks ->
renders.

After flow:

`LeadForm` calls one feature-local `useLeadFormData` hook first -> receives the
same query data, gating flags, and setters as one object -> feeds the same
builders/hooks -> renders unchanged JSX. The six SVG icons and
`RecordVisibilityToggle` render from their own modules.

Load-bearing invariants:

- Period dual-state: preserved; no API, service, repository, or database write
  changes.
- Role-coverage gate: preserved; no tRPC procedure or middleware changes.
- 7c.6 identity purge: preserved; both purge effects move verbatim, including
  dependency arrays.
- Single fullscreen owner: preserved; `deckRef`, `fullscreenToggleRef`, and
  `useFullscreen` stay in `LeadForm`.

## Goals / Non-Goals

**Goals:**

- Move the data-loading layer out of `LeadForm` into a tested feature-local
  hook with a flat return matching the current local names.
- Move the six SVG icon components and `RecordVisibilityToggle` into their own
  modules unchanged.
- Establish the grouped-prop contract (pass cohesive hook/builder results
  wholesale) that the upcoming JSX slices consume.
- Update `architecture-refactor-backlog` with actual post-slice LOC evidence.

**Non-Goals:**

- No JSX tree extraction (next slice, per the recorded council blueprint).
- No draft orchestration, write-action, draft-merge, or view-model changes.
- No backend, shared schema, Prisma, tRPC procedure, route, or UI-string
  changes.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Decisions

### D1: One feature-local `useLeadFormData` hook with a flat return

The layer owns queries and effects, so the boundary must be a hook (unlike the
pure slice-5 builder). It is called as `LeadForm`'s first hook with a fixed,
unconditional internal hook sequence, and returns a flat object whose keys
match the current local names — the established shape of the three sibling
hooks (their returns are 20–24 flat keys).

Alternatives rejected: grouping the return into sub-objects (invents a new
shape and churns every consumer for no behavior gain); extracting the JSX tree
first (Codex seat) — it would thread loose query locals into freshly created
component props that this hook would immediately rework, and a ~605-line JSX
move across 5–7 files in one change is a larger silent-miswiring surface.

### D2: Fullscreen ownership stays in `LeadForm`

`deckRef`, `fullscreenToggleRef`, and `useFullscreen` are a UI concern feeding
JSX directly, and lead-form is the recorded single fullscreen owner. Widening
the data hook to include them buys no line relief and risks the one-`f`-listener
invariant.

### D3: Purge and redirect effects move verbatim

The two cache-purge effects are the 7c.6 security guard (user B must never read
user A's foreign records). They move with their dependency arrays byte-for-byte;
`lead-form-visibility.test.tsx` (7d.7) pins the behavior with a `removeQueries`
spy and stays unchanged. Any dep-array edit in review is a red flag.

### D4: Icons and `RecordVisibilityToggle` relocate unchanged

Verified: no test imports these symbols directly — the aria-hidden icon tests
and the viewmode snapshot assert the rendered DOM of `<LeadForm>`, so a pure
relocation cannot churn them while markup stays identical.

### D5: This hook is NOT the deferred coordinator

`useLeadFormData` is feature-local at the exact granularity of the three landed
sibling hooks: colocated in `report-sections/ui/`, owning only this form's
queries and gating. It is not the deferred `ReportDataCoordinator`
(reusable/cross-role) and not `FormStateManager` (it must never absorb the
draft/write/merge hooks). It must not be imported by head/viewer surfaces.

### D6: Split before exempting

If the hook crosses 250 lines, the two cache-purge effects split into a
`useLeadFormForeignContentPurge` helper hook. The change ships no new
`eslint.config.ts` exempt entry.

## Risks / Trade-offs

- Hook-order regression (the recorded "Rendered more hooks" bug) -> the hook is
  `LeadForm`'s first call with an unconditional internal sequence; the skeleton
  guard stays after all hooks; run the FULL unit suite, never a folder-scoped
  run.
- Identity-purge regression -> effects move verbatim (D3); 7d.7 is the loud
  failure.
- Boundary drifts toward the forbidden coordinator -> D5 names the line;
  review checks imports stay lead-form-local.
- The smaller bite leaves lead-form.tsx at ~975 lines -> accepted: the next
  slices are mechanical JSX splits against the contract this slice stabilizes.

## Migration Plan

1. Add `use-lead-form-data.test.tsx`: renderHook + mocked tRPC/router/query
   client, characterizing byPeriod enablement, crossAuthorContent gating,
   purge-on-toggle/identity, canonical and head-away redirects, and
   targetReportId preference.
2. Add the feature-local hook under
   `apps/web/src/features/report-sections/ui/`.
3. Rewire `LeadForm` to consume the hook's return; keep the skeleton guard,
   view-model call, ref assignments, and JSX unchanged.
4. Move the icons and `RecordVisibilityToggle` to their own modules; update
   imports.
5. Update the backlog spec and delta with actual post-slice LOC evidence.
6. Run focused tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm format:check`, `git diff --check`, and OpenSpec
   validation.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking. If the flat return reads noisy at the call site, the next
  slice's grouped-prop contract (pass the whole `data` object) absorbs it
  without reshaping this hook.
