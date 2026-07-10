## Why

`lead-form.tsx` is still a 1314-line god component after the loaded-view-model
slice. Its last load-bearing logic block is the data-loading layer: six queries
with enablement chains, record-visibility gating, two security-relevant
cache-purge effects, two redirect effects, and three query error handlers all
live directly inside the render component. Until that layer moves behind a
tested boundary, every remaining decomposition slice has to thread loose query
locals through new props.

## What Changes

- Extract the lead-form data-loading layer (queries, enablement chains,
  visibility gating, cache purges, redirects, query error handlers) into a
  feature-local tested hook.
- Move the six file-local SVG icon components and `RecordVisibilityToggle`
  into their own presentational modules, unchanged.
- Preserve current behavior for query enablement, Everyone/Mine content
  gating, foreign-content cache purges on toggle/identity/report change,
  canonical and head-away redirects, and error-handler wiring.
- Keep `LeadForm` responsible for fullscreen ownership, draft orchestration,
  write-action orchestration, draft-merge orchestration, loaded view-model
  consumption, and rendering.
- Record this as the sixth `lead-form.tsx` decomposition slice with actual
  post-slice LOC evidence before archive.

Non-goals:

- No backend, shared schema, Prisma, tRPC procedure, route, or UI-string changes.
- No JSX tree extraction (deferred to the next slice against the grouped-prop
  contract this slice establishes).
- No draft orchestration, write-action, or draft-merge changes.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Capabilities

### New Capabilities

- `lead-form-data-loading`: Defines the extracted data-loading hook boundary
  for lead-form queries, visibility gating, purges, and redirects.

### Modified Capabilities

- `architecture-refactor-backlog`: Records this as the sixth grilled lead-form
  decomposition slice with post-slice LOC evidence.

## Impact

- Affected web files: `apps/web/src/features/report-sections/ui/lead-form.tsx`,
  a new feature-local data-loading hook module with focused tests, and two new
  presentational modules (icons, record-visibility toggle).
- No API, database, dependency, route, or product UI behavior changes.
- Gates: focused lead-form tests, scoped ESLint with `--max-warnings 0`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and
  OpenSpec validation.
