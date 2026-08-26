## ADDED Requirements

### Requirement: Runtime-sweep preflight modules MUST expose bounded ownership groups

Each direct directory under `e2e/runtime-sweep/preflight/` MUST remain within
the repository's existing 30-file ownership limit. Diagnostic sidecars, launch
continuations, and reusable reveal-continuation contracts MUST live in explicit
child ownership groups, with all imports and the runtime-sweep catalogue naming
their physical canonical paths. The structural baseline MUST describe the final
tree and MUST NOT relax the file-count limit.

#### Scenario: Preflight ownership groups pass the directory gate

- **WHEN** the directory-architecture gate counts direct files after the move
- **THEN** `preflight/diagnostics`, `preflight/launch`, and
  `preflight/reveal/continuation` each contain no more than 30 direct files
- **AND** no new exception or higher limit is introduced

#### Scenario: Catalogue and imports follow physical ownership

- **WHEN** the moved runtime-sweep modules are resolved by tests, static imports,
  and the scenario catalogue
- **THEN** every consumer resolves the canonical child-directory path
- **AND** no compatibility copy, shim, or duplicate module remains at the old path

## MODIFIED Requirements

### Requirement: The lead domain MUST dissolve into its canonical slices, not a `features/lead` slice

The legacy `apps/web/src/components/lead/` tree MUST NOT survive as a single
`features/lead` slice. Page-level lead form composition MUST live under
`features/report-pages/ui/lead/`. Reusable report-section UI primitives and
domain model MUST live under `features/report-sections/{ui,model}`; period
navigation and SDLC-pipeline files MUST live under `features/period/{ui,model}`;
risk/review files under `features/review/ui`; `pdf-export-coming-soon` under
`features/pdf-export/ui`; `version-coming-soon` under `features/admin/ui`; and
the generic `confirm-delete-dialog` under `shared/ui/dialogs/` (rule-of-2). The
relocation MUST be behavior-neutral.

The kernel files with wide external fan-in (`stage-tags`, `stage-chip-config`)
MUST reside in `features/report-sections/model/`, not `shared/`, because they
encode report-section domain logic rather than business-agnostic helpers.
Consumers outside the slice MUST use the `features/report-sections` facade
rather than importing its internals.

#### Scenario: components/lead no longer exists

- **WHEN** the lead relocation is applied
- **THEN** `apps/web/src/components/lead/` no longer exists
- **AND** every former lead file resides under `features/<domain>/{ui,model}/` or
  `shared/ui/` per the mapping, with its filename unchanged

#### Scenario: report-sections becomes a slice, unblocking dependents

- **WHEN** the relocation is applied
- **THEN** `features/report-sections/` owns reusable report-section model and UI
  primitives behind its facade
- **AND** lead, weekly, and Head page assemblies live in `features/report-pages`
- **AND** `viewer-report-shell` lives in `features/viewer`

#### Scenario: kernel files are report-sections model, not shared

- **WHEN** a consumer outside the report-sections slice uses `stage-tags` or
  `stage-chip-config`
- **THEN** the implementations reside in `features/report-sections/model/*`
- **AND** the consumer reaches the required export through the
  `features/report-sections` facade
- **AND** none of these kernel files resides under `shared/`

### Requirement: The weekly-report tree MUST dissolve into its canonical slices

The legacy `apps/web/src/components/weekly-report/` tree MUST NOT survive as a
`features/weekly-report` slice. Page-level weekly report composition — including
`weekly-report-page`, `weekly-report-skeleton`, and `product-accordion` — MUST
live under `features/report-pages/ui/`. Reusable assembled-report primitives
such as `activity-status-strip` and `portfolio-overview-table` MUST live under
`features/report-sections/ui/`; their pure projection and grouping model MUST
live under `features/report-sections/model/`. Export, period-lifecycle, and
review-owned controls MUST live under their respective feature slices. The
relocation MUST be behavior-neutral, and the legacy tree MUST NOT survive it.

#### Scenario: components/weekly-report no longer exists

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/components/weekly-report/` no longer exists
- **AND** each former file resides under its canonical feature owner

#### Scenario: consumers import the assembled report from report-pages

- **WHEN** the Head or viewer report shell renders the weekly report page
- **THEN** the Head same-slice composition imports `WeeklyReportPage` through a
  relative module path within `features/report-pages`
- **AND** the viewer shell imports `WeeklyReportPage` from the
  `features/report-pages` facade
- **AND** `features/report-pages` consumes report-section model and primitives
  through the `features/report-sections` facade
- **AND** no code imports `components/weekly-report/*`

## REMOVED Requirements

### Requirement: The head report shell MUST live in the report-sections slice

`head-report-shell.tsx` MUST reside at `apps/web/src/features/report-sections/ui/`
(filename unchanged from `components/head/`), because it is a report-sections
page-level shell composing report-shell primitives plus weekly-report/period/slides
UI — not a standalone `head` domain. The legacy `components/head/` directory MUST
NOT survive. Its route consumer under `app/(app)/head/report/[reportId]/` MUST
import it from `features/report-sections/ui/head-report-shell`. The relocation MUST
be behavior-neutral.

#### Scenario: The head shell lands in report-sections

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/features/report-sections/ui/head-report-shell.tsx` exists
- **AND** `apps/web/src/components/head/` no longer exists
- **AND** the head report route imports it from `features/report-sections/ui/*`

**Reason**: This requirement is superseded by the later page-assembly rule that
keeps `features/report-sections` a pure lower floor and owns the Head shell in
`features/report-pages`.

**Migration**: Retain the existing `features/report-pages` ownership and its
public facade; remove only this contradictory historical requirement.
