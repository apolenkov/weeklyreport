## Why

The lead report form still mixes editing UI with write-side orchestration:
submit, revoke, reopen, and fill-from mutations live beside record merge
handlers and rendering in a 2036-line component. Extracting that command layer
next makes the dangerous write/version paths easier to review without changing
what leads see.

## What Changes

- Extract the lead form's submit, revoke, reopen-request, and fill-from command
  orchestration into a feature-local hook.
- Keep the existing tRPC procedures, payload shapes, toast strings, dialogs, and
  UI layout unchanged.
- Preserve current optimistic-lock behavior: submit and fill-from keep using
  the draft orchestration hook's synchronous `versionRef.current`, stale-version
  conflicts still refetch and show the reload message, and successful writes
  still invalidate the same query families.
- Keep record merge handlers, quick-add state, visibility gates, and route/query
  loading in `LeadForm`; those are separate future slices.

Non-goals:

- No backend, schema, Prisma, or tRPC procedure changes.
- No rewrite of item/risk/decision merge handlers.
- No `FormStateManager` or broad coordinator object.
- No visible product behavior or string changes.

## Capabilities

### New Capabilities

- `lead-form-write-actions`: Defines the extracted write-action orchestration
  boundary for the lead report form.

### Modified Capabilities

- `architecture-refactor-backlog`: Records this as the third grilled
  lead-form decomposition slice with actual post-slice LOC evidence.

## Impact

- Affected web files: `apps/web/src/features/report-sections/ui/lead-form.tsx`,
  a new feature-local hook module, and existing lead-form tests.
- Gates: focused lead-form mutation tests, scoped ESLint with
  `--max-warnings 0`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
  `openspec validate refactor-lead-form-write-actions --strict`.
