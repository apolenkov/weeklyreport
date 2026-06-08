# sweep-runtime-correctness Specification

## Purpose

TBD - created by archiving change fix-sweep-ui-findings. Update Purpose after archive.

## Requirements

### Requirement: Swept role-reachable routes MUST render without React runtime warnings

Every route reachable in the behavioral UI sweep MUST render without React
runtime correctness warnings — specifically no duplicate-`key` console warning
and no hydration-mismatch `pageerror`. List renders MUST use a stable, unique key
per item (not a value that repeats across siblings, such as a 1-based rank or a
shared page index). Server-rendered client components MUST NOT diverge from their
client render due to non-deterministic input (locale/date/`typeof window`).

#### Scenario: a report list render uses unique keys

- **WHEN** the sweep visits `/reports`, `/reports/[reportId]`, or
  `/reports/[reportId]/present` for any role
- **THEN** the console records no "Encountered two children with the same key"
  warning
- **AND** a regression test asserts the list render produces unique keys

#### Scenario: the lead preview route hydrates cleanly

- **WHEN** the sweep visits `/lead/report/[reportId]/preview`
- **THEN** no hydration-mismatch `pageerror` is recorded
- **AND** a regression test pins the previously non-deterministic value

### Requirement: Shared-shell controls swept across roles MUST satisfy the axe rules they currently violate

Shared navigation and report-shell components MUST pass the axe rules the
2026-06-07 sweep flagged at scale across essentially every role-reachable route:
`button-name`, `label`, `link-name`, `nested-interactive`, `region`,
`aria-hidden-focus`, `page-has-heading-one`, and `scrollable-region-focusable`.
`color-contrast` is explicitly excluded here (theme-token work, gated
research-only). A fix at a shared-component source that clears the rule across all
roles is preferred over per-route patching.

#### Scenario: shared-shell axe violations clear across all roles

- **WHEN** the sweep re-runs across `lead`/`head`/`admin`/`viewer` after the fix
- **THEN** the targeted axe rule reports zero violations on every previously
  failing route
- **AND** `color-contrast` is left untouched and tracked as a separate gated item

### Requirement: Sweep console noise MUST be filtered only with a confirmed source

A console pattern MUST NOT be added to the sweep's `IGNORED_CONSOLE` allow-list
until its source is identified. For failed-resource errors, the sweep MUST
capture the failing request URL so the pattern can be classified as a real defect
or genuine environment noise before it is silenced.

#### Scenario: ERR_CONNECTION_REFUSED is classified before being filtered

- **WHEN** the sweep records a `net::ERR_CONNECTION_REFUSED` console error
- **THEN** the report includes the failed request URL
- **AND** the pattern is added to `IGNORED_CONSOLE` only with a comment recording
  the confirmed source, or fixed at source instead
