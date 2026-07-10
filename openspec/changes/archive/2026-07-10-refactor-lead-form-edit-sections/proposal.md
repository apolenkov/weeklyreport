## Why

`lead-form.tsx` is a 986-line component after the data-loading slice. All logic
now lives behind tested boundaries; the remaining bulk is the JSX tree. Its
largest cohesive subtree is the edit-mode section stack — review feedback, the
`LeadFormSyncBridge.Provider` with the Product Status / Activities / items /
Risks accordions, and the Decisions accordion — rendered inline in the
slides-vs-edit branch.

## What Changes

- Extract the edit-mode section stack into a presentational
  `LeadFormEditSections` component, with the unified-vs-classic items
  conditional split into a nested `LeadFormItemSections` so both files stay
  under the 250-line standard.
- Thread the loaded view model and the draft-merge handlers as whole objects
  (the grouped-prop contract from the data-loading slice), plus named
  residuals; no new context, no flat prop bag.
- Keep `LeadFormSyncBridge.Provider` and all five accordions inside one
  component so `.Pipeline` and `.Risks` stay rendered within the Provider.
- Preserve rendered markup byte-identical; existing end-to-end tests must pass
  unchanged.
- Record this as the seventh `lead-form.tsx` decomposition slice with actual
  post-slice LOC evidence before archive.

Non-goals:

- No backend, shared schema, Prisma, tRPC procedure, route, or UI-string changes.
- No toolbar/header/dialog extraction (subsequent slices).
- No hook, view-model, or data-loading changes.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Capabilities

### New Capabilities

None — this slice relocates presentation structure only; the behavior
contracts live in the existing `lead-form-*` capabilities.

### Modified Capabilities

- `architecture-refactor-backlog`: Records this as the seventh grilled
  lead-form decomposition slice with post-slice LOC evidence.

## Impact

- Affected web files: `apps/web/src/features/report-sections/ui/lead-form.tsx`
  and two new presentational modules (`lead-form-edit-sections.tsx`,
  `lead-form-item-sections.tsx`).
- No API, database, dependency, route, or product UI behavior changes.
- Gates: focused lead-form tests, scoped ESLint with `--max-warnings 0`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and
  OpenSpec validation.
