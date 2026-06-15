## MODIFIED Requirements

### Requirement: Swept role-reachable routes MUST render without React runtime warnings

Every route reachable in the behavioral UI sweep MUST render without React
runtime correctness warnings — specifically no duplicate-`key` console warning
and no hydration-mismatch `pageerror`. List renders MUST use a stable, unique key
per item (not a value that repeats across siblings, such as a 1-based rank or a
shared page index). Server-rendered client components MUST NOT diverge from their
client render due to non-deterministic input (locale/date/`typeof window`). The
sweep MUST cover the presentation surface through slides mode
(`/reports/[reportId]?mode=slides`), not the retired `/present` route, which now
308-redirects to slides mode (see `report-routing`).

#### Scenario: a report list render uses unique keys

- **WHEN** the sweep visits `/reports`, `/reports/[reportId]`, or
  `/reports/[reportId]?mode=slides` for any role
- **THEN** the console records no "Encountered two children with the same key"
  warning
- **AND** a regression test asserts the list render produces unique keys

#### Scenario: the lead preview route hydrates cleanly

- **WHEN** the sweep visits `/lead/report/[reportId]/preview`
- **THEN** no hydration-mismatch `pageerror` is recorded
- **AND** a regression test pins the previously non-deterministic value
