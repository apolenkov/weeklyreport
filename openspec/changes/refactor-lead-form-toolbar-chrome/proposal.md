## Why

`lead-form.tsx` is a 443-line composition root after the dialogs-and-header
slice. The last extractable JSX block is the sticky toolbar's context controls
(period navigation, archive filter, record-visibility and view-mode toggles,
collapse-all/fullscreen slot), and the last relocatable logic is the chrome
effect pair (document-title, archive auto-expand). Removing them should bring
the file to the 250-line standard and let its `max-lines` (and, if measured
clean, complexity) exemptions come out of `eslint.config.ts` — the endgame the
decomposition series has been driving toward.

## What Changes

- Extract the toolbar context controls into a presentational
  `LeadFormToolbarControls` component, absorbing the collapse-all
  affordance derivations (`hasCollapsibleContent`, `collapseAllLabel`,
  toggle handler wiring).
- Move the document-title and archive auto-expand effects (and their
  `titleHistoryEntry` derivation) into a feature-local `useLeadFormChrome`
  hook.
- Slim the composition root: drop now-unneeded destructures and imports.
- Remove the `lead-form.tsx` `max-lines` exemption from `eslint.config.ts`;
  re-measure the cyclomatic/cognitive exemptions and remove them too if the
  file now passes (split helpers before ever re-adding an exemption).
- Preserve rendered markup byte-identical; existing end-to-end tests must pass
  unchanged.
- Record this as the ninth `lead-form.tsx` decomposition slice with actual
  post-slice LOC evidence and close the size target if ≤ 250 is reached.

Non-goals:

- No backend, shared schema, Prisma, tRPC procedure, route, or UI-string changes.
- No hook, view-model, or data-loading changes beyond the chrome-effect move.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Capabilities

### New Capabilities

None — this slice relocates presentation structure and chrome effects only.

### Modified Capabilities

- `architecture-refactor-backlog`: Records this as the ninth grilled
  lead-form decomposition slice with post-slice LOC evidence and, if the
  250-line standard is met, records the decomposition target as closed.

## Impact

- Affected web files: `apps/web/src/features/report-sections/ui/lead-form.tsx`,
  two new modules (`lead-form-toolbar-controls.tsx`, `use-lead-form-chrome.ts`),
  and `eslint.config.ts` (exemption teardown).
- No API, database, dependency, route, or product UI behavior changes.
- Gates: focused lead-form tests, scoped ESLint with `--max-warnings 0`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and
  OpenSpec validation.
