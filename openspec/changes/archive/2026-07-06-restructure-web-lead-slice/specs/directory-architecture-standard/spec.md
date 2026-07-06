## ADDED Requirements

### Requirement: The lead domain MUST dissolve into its canonical slices, not a `features/lead` slice

The legacy `apps/web/src/components/lead/` tree MUST NOT survive as a single
`features/lead` slice. Its files MUST relocate to the canonical domain slice each
belongs to, per `docs/architecture/mapping/web-comp-lead-2026-07-02.md`: the
report-section rendering core (`lead-form`, `item-card*`, `item-edit-dialog`,
`next-week-section`, the item-board kit `board-column-header`/`board-empty-state`/
`activity-lanes-block`, `stage-chip`, and the kernel model files `mock-data`,
`stage-tags`, `stage-chip-config`, `next-week-columns`, `item-card-style`,
`record-parent`, `stage-ownership`) MUST live under `features/report-sections/{ui,model}`;
the period-navigation and SDLC-pipeline files MUST live under `features/period/{ui,model}`;
the risk/review files under `features/review/ui`; `pdf-export-coming-soon` under
`features/pdf-export/ui`; `version-coming-soon` under `features/admin/ui`; and the
generic `confirm-delete-dialog` under `shared/ui/` (rule-of-2). The relocation
MUST be behavior-neutral.

The kernel files with wide external fan-in (`mock-data`, `stage-tags`,
`stage-chip-config`) MUST reside in `features/report-sections/model/`, not
`shared/`, because they encode report-section domain logic rather than
business-agnostic helpers; their consumers outside the slice (hooks, lib mappers,
head/viewer/weekly-report/slides) import them at their `report-sections/model`
path.

Because this is a multi-home dissolve (not a single clean slice), it MUST NOT
enable cross-slice enforcement for the affected slices in this change: no
`webSlices` entry and no zone-5 `except` are added for `report-sections`,
`period`, or `review`. The pre-existing and newly-surfaced cross-slice imports
(e.g. `report-sections` ↔ `period` ↔ `review`) stay unenforced until a dedicated
boundaries slice, following the `admin` dissolve precedent.

#### Scenario: components/lead no longer exists

- **WHEN** the lead relocation is applied
- **THEN** `apps/web/src/components/lead/` no longer exists
- **AND** every former lead file resides under `features/<domain>/{ui,model}/` or
  `shared/ui/` per the mapping, with its filename unchanged

#### Scenario: report-sections becomes a slice, unblocking dependents

- **WHEN** the relocation is applied
- **THEN** `features/report-sections/` exists with the report-section core under
  `ui/` and the kernel model files under `model/`
- **AND** `head-report-shell`, `viewer-report-shell`, and the `weekly-report`
  dissolution can now target `features/report-sections/`

#### Scenario: kernel files are report-sections model, not shared

- **WHEN** a consumer outside the report-sections slice (a hook, a lib mapper, or
  the head/viewer/weekly-report/slides code) uses `mock-data`, `stage-tags`, or
  `stage-chip-config`
- **THEN** it imports them from `features/report-sections/model/*`
- **AND** none of these kernel files reside under `shared/`

#### Scenario: the dissolve does not enable cross-slice enforcement

- **WHEN** `eslint.config.ts` is evaluated after the relocation
- **THEN** the `webSlices` array gains no `report-sections`, `period`, or `review`
  entry, and no zone-5 `except` is added for their mutual cross-slice imports
- **AND** the 10 path-pinned complexity/max-lines exemptions reference the files'
  new homes, not `components/lead/*`
