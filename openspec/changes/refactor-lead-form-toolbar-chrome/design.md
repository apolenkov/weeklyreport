## Context

`apps/web/src/features/report-sections/ui/lead-form.tsx` is 443 lines after
`refactor-lead-form-dialogs-and-header`. What remains: imports, props, the
five boundary-hook calls with their wiring, the skeleton guard, the loaded
view-model call, render-phase ref assignments, three chrome derivations
(collapse-all affordance, title effect, archive auto-expand effect), and a
composition-only JSX return (header call, toolbar, read-only banner,
slides/edit branch, dialogs call).

This is the final slice of the council blueprint recorded in the edit-sections
slice (toolbar contextControls + a thin chrome hook). Codex remains
unavailable for stop-time review (auth token requires interactive re-login).

Load-bearing invariants:

- Single fullscreen owner: `deckRef`, `fullscreenToggleRef`, `useFullscreen`
  stay in `LeadForm`; the toolbar component receives `slidesFullscreen` and
  `fullscreenToggleRef` as props exactly as `ReportToolbar` markup does today.
- `groupExpanded` STATE stays in `LeadForm` (it feeds `LeadFormEditSections`
  too); only the toggle-affordance derivations move into the toolbar
  component.
- The `useRecordVisibility` toggle wiring (`toolbarVisibility`,
  `setRecordVisibility`, foreign-deck inertness) moves as markup only — the
  state lives in `useLeadFormData` already.
- Rendered markup stays byte-identical; the end-to-end suites are the pins.

## Goals / Non-Goals

**Goals:**

- Extract `LeadFormToolbarControls` (toolbar contextControls fragment +
  collapse-all derivations) and `useLeadFormChrome` (title + archive-expand
  effects with the `titleHistoryEntry` derivation).
- Bring `lead-form.tsx` to ≤ 250 lines and remove its `max-lines` exemption;
  re-measure and, if clean, remove its cyclomatic/cognitive exemptions.
- Update `architecture-refactor-backlog` with final LOC evidence; if the
  250-line standard is met, record the size target as CLOSED (slices list
  stays as history).

**Non-Goals:**

- No behavior changes anywhere; no styling changes.
- No further hook consolidation (the five boundaries stay five).
- No backend, shared schema, Prisma, tRPC, route, or UI-string changes.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Decisions

### D1: Toolbar component absorbs the collapse-all derivations

`hasCollapsibleContent`, `collapseAllLabel`, and the toggle click handler are
pure functions of `viewModel` counts and `groupExpanded` — presentation
affordances of the toolbar's trailing slot. They move INTO
`LeadFormToolbarControls`; `LeadForm` passes `groupExpanded` and
`onToggleGroupExpanded` (the state setter wrap) down. The state itself stays
up because the accordions consume it.

### D2: `useLeadFormChrome` owns title + archive-expand effects

Both effects are lifecycle chrome keyed on loaded data
(`byPeriodData`/`historyData`/`selectedPeriodId`): document.title set/restore
and the one-way archive auto-expand. They move behind one small feature-local
hook returning `{ showArchivePeriods, setShowArchivePeriods }` — the only
values the composition still needs. `selectedPeriodId` derivation moves with
them (it is chrome-scoped: period picker + view-model input), returned
alongside.

Alternative rejected: leaving the effects inline — they are the last
non-composition logic in the file and block the 250 target.

### D3: Exemption teardown is part of the slice, not a follow-up

The goal state is `eslint.config.ts` WITHOUT `lead-form.tsx` entries. After
the extraction, remove the `max-lines` entry (file must be ≤ 250) and probe
the cyclomatic/cognitive entries by removal + scoped lint: after the JSX
moved, the remaining branching should sit under the thresholds; if a probe
still fires, split composition helpers rather than re-adding the entry.

## Risks / Trade-offs

- Toolbar markup drift (control order/props) -> byte-identical relocation;
  the viewmode snapshot and toolbar-related assertions in the end-to-end
  suites pin it; adversarial verifier diffs old vs new.
- Title-effect timing change -> the hook is called in the same position
  relative to the loaded data (after `useLeadFormData`), with identical
  dependency arrays; the existing document.title test in lead-form.test.tsx
  pins the format and restore-on-unmount.
- Archive auto-expand loop (state now behind a hook) -> effect body and deps
  move verbatim; `setShowArchivePeriods` identity unchanged (useState setter).
- File lands just above 250 after teardown -> slim the composition (drop the
  chrome destructures, reference `viewModel.x` at single-use sites) before
  considering any exemption; the exemption does NOT go back.

## Migration Plan

1. Add `use-lead-form-chrome.ts` (selectedPeriodId + titleHistoryEntry +
   title effect + archive state/effect).
2. Add `lead-form-toolbar-controls.tsx` (contextControls fragment + collapse
   derivations).
3. Rewire `lead-form.tsx`; slim imports/destructures.
4. Remove the `max-lines` exemption; probe cyclomatic/cognitive entries.
5. Update the backlog spec and delta with final LOC evidence; mark the size
   target closed if ≤ 250.
6. Run focused tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm format:check`, `git diff --check`, and OpenSpec
   validation.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking.
