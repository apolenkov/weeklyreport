## ADDED Requirements

### Requirement: The lib/mappers tree MUST dissolve into each slice's model dir

The legacy `apps/web/src/lib/mappers/` tree MUST NOT survive as a shared mapper
barrel. Each mapper file MUST relocate to the `model/` dir of the domain that owns
it, per `docs/architecture/mapping/web-lib-2026-07-02.md`: the admin mappers
(`admin`, `admin-form-inputs`, `admin-types`) under `features/admin/model`; the
dashboard mappers (`dashboard`, `dashboard-counts`, `dashboard-escalations`,
`dashboard-kpi`, `dashboard-leads`) under `features/dashboard/model`; and the
report-translation core (`item-status`, `lead-cross-author`, `lead-form`,
`lead-history`, `lead-status`, `report-content`, `traffic-light`, `weekly-report`,
`weekly-report-groupers`, `weekly-report-types`) under
`features/report-sections/model`. The `index.ts` barrel MUST be deleted and each
consumer MUST import from the concrete owning `model/` file. The relocation MUST be
behavior-neutral, and the `lib/mappers/` tree MUST NOT survive it.

#### Scenario: lib/mappers no longer exists

- **WHEN** the dissolution is applied
- **THEN** `apps/web/src/lib/mappers/` no longer exists
- **AND** each former mapper resides under `features/<domain>/model/` per the mapping

#### Scenario: consumers import mappers from the owning slice, not a barrel

- **WHEN** any file consumes a mapper symbol
- **THEN** it imports that symbol from the concrete `features/<domain>/model/*` file
- **AND** no code imports `lib/mappers` or a `lib/mappers/*` path
