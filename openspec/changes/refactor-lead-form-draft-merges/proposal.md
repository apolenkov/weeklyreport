## Why

The lead report form still keeps record edit merge semantics inside the render
component: product status, item, risk, decision, activity status, move actions,
and quick-add routing all mutate the local draft beside query wiring and JSX.
This is now the highest-risk remaining `LeadForm` responsibility because these
handlers preserve activity-parent XOR fields, strip foreign read-only rows, and
maintain published-lineage identity.

## What Changes

- Extract the lead form's draft merge handlers into a feature-local boundary
  that owns presentation-to-draft updates for products, activity status, items,
  risks, decisions, item move actions, blocker routing, and quick-add item save.
- Keep existing child component props, UI layout, strings, tRPC calls, autosave
  contract, and write-action hook behavior unchanged.
- Add characterization coverage before moving code for the load-bearing merge
  paths: activity-parent preservation, foreign-row stripping, stable item
  identity during move actions, paused reason clearing, priority rank
  preservation, and quick-add routing.
- Record this as the fourth `lead-form.tsx` decomposition slice with actual
  post-slice LOC evidence.

Non-goals:

- No backend, shared schema, Prisma, or tRPC procedure changes.
- No route/query/session/visibility extraction.
- No render layout extraction or component restyling.
- No broad `FormStateManager` or `ReportDataCoordinator`.

## Capabilities

### New Capabilities

- `lead-form-draft-merges`: Defines the extracted draft merge boundary for lead
  form presentation edits.

### Modified Capabilities

- `architecture-refactor-backlog`: Records this as the fourth grilled
  lead-form decomposition slice with actual post-slice LOC evidence.

## Impact

- Affected web files: `apps/web/src/features/report-sections/ui/lead-form.tsx`,
  a new feature-local draft-merge hook/module, and existing lead-form tests.
- No API, database, dependency, or route changes.
- Gates: focused lead-form tests, scoped ESLint with `--max-warnings 0`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
  `openspec validate refactor-lead-form-draft-merges --strict`.
