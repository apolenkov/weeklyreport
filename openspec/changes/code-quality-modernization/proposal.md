# Code-quality modernization (Wave 3)

## Why

The 2026-05-29 code-quality inventory found no critical dead code and a strong
lint/format setup, but flagged a small, concrete set of structural debts that
make the highest-traffic code harder to reason about and change safely:

- `admin.service.ts` is a 967-LOC monolith mixing period creation, manual
  results, reminders, snapshots, and projects in one class — hard to test in
  isolation and a magnet for further accretion.
- `packages/shared/src/schemas/report.ts` is a 1,037-LOC single schema file
  spanning report, section, period, and stage concerns; any schema edit forces
  a reader to scan the whole file.
- The `apps/web` `status-risk` hooks (`use-status-risk-sync.ts`,
  `use-status-risk-coupling.ts`) are tightly coupled but split, so the coupling
  logic has to be re-derived from two files.
- One isolated `eslint-disable @typescript-eslint/no-explicit-any` escape hatch
  in `action-log-tab.tsx` is the only `any` cast in the web app.

These are behavior-preserving cleanups, not feature work. The inventory
explicitly warns that the `report-sections` module is HOT ZONE (regression-heavy
UAT per CLAUDE.md): any structural change there is allowed ONLY when guarded by
the existing green tests PLUS a new characterization test that proves behavior
is preserved.

This change is sequenced AFTER `migrate-to-biome` lands so the decomposed files
are formatted and linted by the final single toolchain, avoiding a churny
re-format pass and rule drift mid-refactor.

## What Changes

- **apps/api — admin decomposition (non-HOT-ZONE).** Split `admin.service.ts`
  into focused services (`PeriodAdminService`, `ReminderAdminService`,
  `ProjectAdminService`, `SnapshotAdminService`) wired through `admin.module.ts`.
  Public tRPC procedure surface and behavior unchanged; existing
  `admin.integration.test.ts` stays green.
- **packages/shared — schema split.** Break `report.ts` into domain-scoped
  files (`report.schema.ts`, `section.schema.ts`, `period.schema.ts`,
  `stage.schema.ts`) re-exported from a barrel so every existing import path and
  exported symbol is preserved. No symbol renames (the misnamed `stageIds` field
  keeps its name — renaming is out of scope). The 1,816-LOC test suite stays
  green.
- **apps/web — status-risk hook consolidation.** Combine the coupling/sync
  logic behind one composable (or a shared factory) so callers depend on a
  single hook; existing hook tests stay green.
- **apps/web — remove the lone `any` escape hatch.** Type the
  `trpc.admin.actionLog.list` infinite-query call in `action-log-tab.tsx` and
  delete the `eslint-disable` comment.
- **apps/api — report-sections (HOT ZONE), behavior-preserving only.** Extract
  `VersionHistoryService` and `SnapshotService` boundaries out of the section
  services, gated by a NEW characterization test that pins current submission /
  version-history / fill-from / version-retention / snapshot-capture behavior
  before and after the move. No query-semantics changes.

Out of scope: dependency upgrades, the Biome migration itself, any
visual/theme/layout work, schema/field renames, and Prisma migrations.

## Impact

- **apps/api**: `modules/admin/*` (new service files + module wiring),
  `modules/report-sections/*` (HOT ZONE — extraction guarded by a new
  characterization test). Risk: medium for admin (well-covered, low
  interactivity), high for report-sections (mitigated by the mandatory
  characterization test plus existing green integration tests).
- **packages/shared**: `src/schemas/report.ts` → split files + barrel. Risk:
  low — pure re-organization, comprehensive existing test suite, no symbol
  changes.
- **apps/web**: `hooks/use-status-risk-*.ts`, `components/admin/action-log-tab.tsx`.
  Risk: low.
- No DB, no migration, no public API contract change, no UI string change.
- Depends on `migrate-to-biome` landing first.
