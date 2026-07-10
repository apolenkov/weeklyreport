## Why

`lead-form.tsx` is still a 1485-line god component after the draft-merge slice.
Its next load-bearing responsibility is the loaded view-model block: it turns
the loaded draft and query results into display products, own/foreign rows,
published-lineage locks, unified activity entries, period filters, and read-only
flags directly inside the render component.

## What Changes

- Extract the post-skeleton lead-form loaded view-model derivations into a
  feature-local tested boundary.
- Preserve current behavior for cross-author stage overrides, Everyone/Mine
  full-content gating, foreign-row display merges, own-only priority ranks,
  published-lineage lock sets, fill-from lock derivation, unified activity
  buckets, activity alarm floors, visible-period filtering, and read-only state.
- Keep `LeadForm` responsible for route/query/session/visibility setup, draft
  orchestration, write-action orchestration, draft-merge orchestration, and
  rendering.
- Record this as the fifth `lead-form.tsx` decomposition slice with actual
  post-slice LOC evidence before archive.

Non-goals:

- No backend, shared schema, Prisma, tRPC procedure, route, or UI-string changes.
- No query/routing/session/visibility extraction.
- No render layout extraction, section component split, or restyling.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Capabilities

### New Capabilities

- `lead-form-loaded-view-model`: Defines the extracted loaded view-model
  boundary for lead-form display derivations.

### Modified Capabilities

- `architecture-refactor-backlog`: Records this as the fifth grilled lead-form
  decomposition slice with post-slice LOC evidence.

## Impact

- Affected web files: `apps/web/src/features/report-sections/ui/lead-form.tsx`,
  a new feature-local loaded-view-model module/hook, and focused tests.
- No API, database, dependency, route, or product UI behavior changes.
- Gates: focused lead-form tests, scoped ESLint with `--max-warnings 0`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and
  OpenSpec validation.
