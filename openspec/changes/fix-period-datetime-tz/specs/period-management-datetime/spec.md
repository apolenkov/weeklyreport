## ADDED Requirements

### Requirement: Deadline datetime input MUST round-trip as UTC

The Period management create/edit dialog MUST parse the `datetime-local`
deadline field value as UTC wall-clock on submit, by appending `:00.000Z`
before constructing the `Date` in
`apps/web/src/components/admin/periods-tab-dialog.tsx`, so that the value
read into the field and the value written back are identical regardless of
the admin's local timezone. The field is populated for display from the
stored UTC `Date` via `toISOString().slice(0,16)` (UTC wall-clock); the
parse MUST be the exact inverse of that display, never `new Date(value)`
(which the browser interprets as local time).

#### Scenario: Non-UTC admin re-saves an unchanged deadline

- **GIVEN** an admin whose browser timezone is UTC+3
- **AND** an existing period whose stored deadline is `2026-07-03T12:00:00.000Z`
- **WHEN** the admin opens the edit dialog and submits without touching the deadline field
- **THEN** the deadline submitted to the mutation is still `2026-07-03T12:00:00.000Z`
- **AND** it does not drift to `2026-07-03T09:00:00.000Z`

#### Scenario: Repeated edit round-trips do not accumulate drift

- **GIVEN** an admin in any non-UTC timezone
- **WHEN** the admin opens, saves, and re-opens the same period's edit dialog three times without changing the deadline
- **THEN** the submitted deadline is byte-identical across all three saves

### Requirement: Deadline range validation MUST compare in UTC

The in-dialog deadline range check MUST parse the deadline field value as
UTC (appending `:00.000Z`) before comparing it against the UTC-parsed
`periodStart` (`T00:00:00.000Z`) and `periodEnd` (`T23:59:59.999Z`) bounds,
so that the "Deadline cannot be before period start" / "after period end"
errors fire on the true instant the value will be saved, not on a
local-time misread.

#### Scenario: Non-UTC admin sets an in-range deadline

- **GIVEN** an admin whose browser timezone is UTC+3
- **AND** a period spanning `2026-07-01` to `2026-07-07`
- **WHEN** the admin enters a deadline of `2026-07-01T01:00` in the field
- **THEN** the validation parses it as `2026-07-01T01:00:00.000Z`
- **AND** no "Deadline cannot be before period start" error is shown
- **AND** the submit parse and the validation parse agree on the same instant

### Requirement: Period start and end date inputs MUST be parsed as UTC

The `periodStart` and `periodEnd` `date` field values MUST be parsed as UTC
by appending an explicit UTC time suffix (`T00:00:00.000Z` for start,
`T23:59:59.999Z` for end), and MUST NOT be parsed with bare
`new Date(value)`. This requirement records the existing correct behavior as
an invariant so a future edit cannot silently reintroduce a local-time
parse alongside the deadline fix.

#### Scenario: Period boundaries are timezone-independent

- **GIVEN** an admin in any timezone
- **WHEN** the admin submits `periodStart = 2026-07-01` and `periodEnd = 2026-07-07`
- **THEN** the start parses to `2026-07-01T00:00:00.000Z`
- **AND** the end parses to `2026-07-07T23:59:59.999Z`
