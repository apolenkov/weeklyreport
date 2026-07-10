## Why

`lead-form.tsx` is a 698-line component after the edit-sections slice. The two
remaining large JSX blocks are the page header with its document-action group
(Save / Fill-From / Quick-add / Submit / Request-Reopen / Revoke and the
deferred Version/PDF controls) and the dialog cluster (submit confirmation,
quick-add item host, request-reopen, revoke confirmation).

## What Changes

- Extract the page header and document-action group into a presentational
  `LeadFormHeaderActions` component.
- Extract the dialog cluster into a presentational `LeadFormDialogs`
  component.
- Thread the loaded view model, draft-merge handlers, and write-action
  handlers as whole objects (the established grouped-prop contract), plus
  named residuals; no new context, no flat prop bag.
- Preserve rendered markup byte-identical; existing end-to-end tests must pass
  unchanged.
- Record this as the eighth `lead-form.tsx` decomposition slice with actual
  post-slice LOC evidence before archive.

Non-goals:

- No backend, shared schema, Prisma, tRPC procedure, route, or UI-string changes.
- No toolbar/context-controls extraction and no title/archive effect changes
  (final slice).
- No hook, view-model, or data-loading changes.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Capabilities

### New Capabilities

None — this slice relocates presentation structure only; the behavior
contracts live in the existing `lead-form-*` capabilities.

### Modified Capabilities

- `architecture-refactor-backlog`: Records this as the eighth grilled
  lead-form decomposition slice with post-slice LOC evidence.

## Impact

- Affected web files: `apps/web/src/features/report-sections/ui/lead-form.tsx`
  and two new presentational modules (`lead-form-header-actions.tsx`,
  `lead-form-dialogs.tsx`).
- No API, database, dependency, route, or product UI behavior changes.
- Gates: focused lead-form tests, scoped ESLint with `--max-warnings 0`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and
  OpenSpec validation.
