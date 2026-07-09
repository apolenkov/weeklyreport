## Why

The lead edit form is still too large to reason about safely: `lead-form.tsx`
is 2117 lines and mixes report loading, local draft reseeding, optimistic-lock
version state, autosave setup, conflict handling, submit, and fill-from writes
inside the same render component. This slice starts the next recorded
decomposition step from `architecture-refactor-backlog` without changing the
user-visible form.

## What Changes

- Extract the lead form's draft/version/autosave orchestration into a focused,
  tested hook under the report-sections feature.
- Keep the existing UI composition, record merge handlers, tRPC procedures,
  payload shape, autosave hook, and visible strings unchanged.
- Preserve the current version guardrails: refetch-only version bumps do not
  dirty the form, autosave-confirmed versions reach submit/fill-from, and stale
  write conflicts refetch and surface the reload toast.
- Add characterization coverage before the extraction so the refactor can prove
  behavior preservation; submit and fill-from keep their current mutations but
  consume the extracted current-version and conflict APIs.

Non-goals:

- No `ReportDataCoordinator` or `FormStateManager` object in this slice.
- No rewrite of item/risk/decision merge handlers.
- No new write endpoints, schemas, or product behavior.
- No attempt to bring `lead-form.tsx` under the 250-line target in one change.

## Capabilities

### New Capabilities

- `lead-form-draft-orchestration`: Defines the extracted draft/version/autosave
  orchestration boundary for the lead report form.

### Modified Capabilities

- `architecture-refactor-backlog`: Records this as the second grilled
  lead-form decomposition slice, citing the current 2117 LOC evidence.

## Impact

- Affected web files: `apps/web/src/features/report-sections/ui/lead-form.tsx`,
  existing lead-form tests, and a new hook module/test in the same feature.
- Gates: focused web tests for lead-form/autosave behavior, `pnpm typecheck`,
  scoped ESLint with `--max-warnings 0`, full `pnpm lint`, and `pnpm test`.
