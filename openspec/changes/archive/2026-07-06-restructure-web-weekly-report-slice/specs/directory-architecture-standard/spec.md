## ADDED Requirements

### Requirement: The weekly-report tree MUST dissolve into its canonical slices

The legacy `apps/web/src/components/weekly-report/` tree MUST NOT survive as a
`features/weekly-report` slice. Its files MUST relocate to the canonical domain
each belongs to, per `docs/architecture/mapping/web-comp-weekly-report-2026-07-02.md`:
the assembled-report rendering core (`activity-status-strip`, `portfolio-overview-table`,
`product-accordion`, `weekly-report-page`, `weekly-report-skeleton`) under
`features/report-sections/ui`; `export-pdf-button` under `features/pdf-export/ui`;
the publish/reopen controls (`head-publish-lock-action`, `publish-lock-button`)
under `features/period/ui`; the review-mode components under `features/review/ui`
and the pure mapper `section-review-rows` under `features/review/model`. The
relocation MUST be behavior-neutral, and the `components/weekly-report/` tree MUST
NOT survive it.

#### Scenario: components/weekly-report no longer exists

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/components/weekly-report/` no longer exists
- **AND** each former file resides under `features/<domain>/{ui,model}/` per the mapping

#### Scenario: consumers import the assembled report from report-sections

- **WHEN** the head or viewer report shell renders the weekly report page
- **THEN** it imports `WeeklyReportPage` from `features/report-sections/ui/*`
- **AND** no code imports `components/weekly-report/*`
