## Why

Four reviewed P2 code-health findings share one root cause: parallel copies of
the same logic that drift silently and tests that look like a safety net but
guard nothing. Duplicated derivations (scope filter, KPI ratio, "report has
content", worst-status), dead routers/components/test mocks, hand-rolled dialog
focus handling, and asymmetric Prisma FK delete policy each let a future edit
introduce a defect the gates would not catch. This is a grouped cleanup bundling
the source findings `consolidate-duplicated-derivations`,
`cleanup-dead-code-and-test-infra`, `shared-dialog-focus-management`, and
`align-fk-ondelete` from the 2026-06-28 repo-excellence review.

## What Changes

- Extract single-source-of-truth helpers for the four duplicated derivations
  (`allowedGroupIds`, on-time-ratio, `reportHasContent`, worst-status) and reuse
  them at every site; add the missing `priorityRank` to `LeadKanbanItem`.
- Remove dead, never-wired code (parallel `*.router.ts` + passport-JWT plumbing,
  unimported components, dead redirect query params) once proven unused, or wire
  it as the single path.
- Make the test infrastructure honest: the parallel MSW mock layer either fires
  (with a test) or is deleted; spies are restored between tests; misleading
  test-util docstrings are fixed.
- Adopt one shared focus-trap + focus-restore dialog primitive across the
  non-admin confirm/edit/publish modals, fix the false "traps focus" JSDoc, and
  fix `ScopeToggle` roving tabindex / `LockBadge` dead focus handlers.
- Align `Decision`/`StageStatus` FK `onDelete` to project with `Item`/`Risk`
  (RESTRICT for report content) so no future hard-delete silently drops authored
  content; document that hard product deletion is unsupported.

## Non-goals

- The full traffic-light enum re-typing across ~33 files (the recorded
  `architecture-refactor-backlog` SSOT target); this change only collapses the
  duplicated `computeWorstStatus` as one slice of it.
- Migrating the admin CRUD dialogs' behavior — they already satisfy
  `admin-dialog-focus-management`; only their focus implementation is unified
  onto the shared primitive.
- Any behavior change. Every refactor here is behavior-preserving.

## Capabilities

### New Capabilities

- `shared-derivation-ssot`: each cross-module derivation has one exported
  implementation reused at every call site, with no parallel copy.
- `dead-code-elimination`: code proven unused is removed (or wired) so the
  surface does not imply paths that production never runs.
- `test-mock-hygiene`: test mocks and spies are restored between tests and
  test-util documentation matches what the code does.
- `shared-dialog-focus-management`: non-admin modal dialogs trap and restore
  focus via one shared primitive.

### Modified Capabilities

- `web-trpc-test-harness`: add that no dead parallel HTTP-mock layer may exist
  alongside `createMockTRPC`.
- `admin-dialog-focus-management`: add that admin dialogs source focus
  management from the shared primitive (behavior unchanged).
- `schema-conventions`: add a consistent FK `onDelete` policy for report-content
  models referencing `Project`.

## Impact

- api: `cross-group-signal.ts`, `telemetry.*`, weekly-report repository,
  `published-report-snapshot.ts`, dead `auth.module`/`jwt.strategy`/`*.router.ts`,
  api test-utils.
- web: weekly-report page, `lead-form` mappers, dialogs (`risk`/`decision`/
  `reopen`/`confirmation`/`publish-lock`), `scope-toggle`, `lock-badge`, dead
  components/redirects, web test-utils (MSW, vitest config/setup).
- shared: `LeadKanbanItem` type.
- prisma: `schema.prisma` + the single init migration (MVP reshape, not an
  incremental alter-table migration).
