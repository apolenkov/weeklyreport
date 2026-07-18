# code-quality-modernization Specification

## Purpose

TBD - created by archiving change code-quality-modernization. Update Purpose after archive.

## Requirements

### Requirement: HOT ZONE Refactors MUST Be Guarded By A Characterization Test

A structural refactor of HOT ZONE code MUST be guarded by a new characterization
test that pins the current observable behavior. HOT ZONE code means product,
group, report-period, or query-semantics paths, including the `report-sections`
module. The test MUST be green against the code before the refactor and MUST
remain green after it, in addition to all pre-existing tests for that code.

#### Scenario: Extracting a service from a HOT ZONE module

- **WHEN** `VersionHistoryService` / `SnapshotService` are extracted from the
  `report-sections` services
- **THEN** a new characterization test covering submission, version history,
  fill-from, version retention, and snapshot capture is added and is green
  before the extraction
- **AND** that test plus every pre-existing `report-sections` test stays green
  after the extraction

#### Scenario: A HOT ZONE refactor lacks a characterization test

- **WHEN** a reviewer evaluates a structural change to HOT ZONE code that adds no
  new characterization test
- **THEN** the change is rejected until the guarding test is added

### Requirement: Behavior-Preserving Refactors MUST NOT Change Observable Behavior

Every refactor in this change MUST preserve observable behavior: the public tRPC
procedure surface, exported symbols and import paths, database schema, Prisma
migrations, and production UI strings MUST be unchanged. No symbol is renamed
(the legacy-misnamed `stageIds` field keeps its name).

#### Scenario: Admin service is decomposed

- **WHEN** `admin.service.ts` is split into focused admin services wired through
  `admin.module.ts`
- **THEN** the tRPC procedure surface and every public method signature are
  unchanged
- **AND** `admin.integration.test.ts` passes without modification to its
  assertions

#### Scenario: Shared schema file is split

- **WHEN** `packages/shared/src/schemas/report.ts` is split into domain-scoped
  files behind a barrel
- **THEN** every previously exported symbol is still exported from its original
  import path
- **AND** the existing `report.test.ts` suite passes with no behavioral change

### Requirement: The Lone Web Any Escape Hatch MUST Be Removed

The repository MUST remove the single `eslint-disable
@typescript-eslint/no-explicit-any` in
`apps/web/src/components/admin/action-log-tab.tsx` by typing the underlying tRPC
infinite-query call, leaving no remaining `any` cast in that file.

#### Scenario: Linting the action log component

- **WHEN** `pnpm lint` runs over `action-log-tab.tsx`
- **THEN** it passes with no `eslint-disable` for `no-explicit-any` present in
  the file
- **AND** the action-log list still loads and paginates identically

### Requirement: This Change MUST Be Sequenced After The Biome Migration

The code-quality refactors MUST NOT begin until `migrate-to-biome` has landed,
so the decomposed files are linted and formatted by the final single toolchain.

#### Scenario: Starting the refactor

- **WHEN** work on this change begins
- **THEN** `pnpm lint` already runs the post-migration Biome toolchain
- **AND** no file in this change is edited before that prerequisite is met

### Requirement: Print and admin surfaces reuse canonical presentation helpers instead of reimplementing them

Print status labels MUST be produced by calling the canonical `statusLabel(status, "print")` helper in `lib/status-presentation`, and any admin surface rendering a plus icon MUST render the canonical `PlusIcon` from `shared/ui/icons` rather than a locally reimplemented copy.

#### Scenario: A print surface renders a status label

- **WHEN** `print-portfolio-table.tsx` or `print-lead-section.tsx` renders a report or product status
- **THEN** it calls `statusLabel(status, "print")` from `lib/status-presentation`
- **AND** no local `printStatusLabel` function exists in `print-report-theme.ts`

#### Scenario: An admin tab renders the add/create icon

- **WHEN** `reminders-tab.tsx` or `reminders-empty-state.tsx` renders the plus icon next to a create action
- **THEN** it imports `PlusIcon` from `shared/ui/icons`
- **AND** no local `PlusIcon` definition remains in `policy-form.tsx`

#### Scenario: Rendered label and icon output is unchanged

- **WHEN** the on-track, at-risk, blocked, and empty print labels are rendered, and the reminders plus icon is rendered
- **THEN** the rendered text and markup match the pre-change output byte-for-byte
