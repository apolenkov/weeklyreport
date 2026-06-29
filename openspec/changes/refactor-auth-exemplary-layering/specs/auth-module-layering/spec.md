## ADDED Requirements

### Requirement: The auth module owns authentication only

The auth module (`apps/api/src/modules/auth/**`) MUST NOT contain
reporting-period or report-section persistence logic. Computing reporting-period
bounds, creating `Report` rows, and creating `ReportSection` / `ProjectStatus`
rows are report-domain concerns and MUST live outside the auth module. The auth
module MAY depend on the report and period domains to build a login session, but
the report and period domains MUST NOT depend on the auth module.

#### Scenario: Period bound math is not defined in the auth module

- **GIVEN** the reporting-period week-bounds helper (`getCurrentWeekBounds`)
- **WHEN** any module needs it (the period-creator scheduler, the period factory)
- **THEN** it is imported from `apps/api/src/lib/business-date.ts`
- **AND** no module imports it from `apps/api/src/modules/auth/**`

#### Scenario: The period module does not import the auth module

- **WHEN** the dependency graph of `apps/api/src/modules/period/**` is inspected
- **THEN** it contains no import from `apps/api/src/modules/auth/**`

### Requirement: Login session-building delegates period creation to the sanctioned writer

When a lead logs in and has no active section, the session-building path MUST
create the current reporting period through the single period-creation factory in
the `period` module (which routes through `period-transition.ts::buildTransition`),
not through a raw `prisma.report.create` in the auth module. Lead-section
materialisation (`ReportSection` + `ProjectStatus`) MUST be performed by the
report-section domain, invoked through a narrow injected function.

#### Scenario: Lead login with no period in the current week

- **GIVEN** a lead with no active draft section and no `Report` for the current week
- **WHEN** the lead logs in
- **THEN** the current-week `Report` is created by the period factory through
  `buildTransition` (both `periodState` and the legacy tuple set atomically)
- **AND** the lead's `ReportSection` and per-project `ProjectStatus` rows are
  created by the report-section domain
- **AND** the auth module performs no `Report` / `ReportSection` / `ProjectStatus`
  create itself

#### Scenario: Lead login when the current-week period already exists

- **GIVEN** a `Report` already exists for the current week
- **WHEN** the lead logs in
- **THEN** the period factory returns the existing `Report` without creating a new one
- **AND** the lead's section is created in that existing `Report` if absent

### Requirement: Authentication behaviour is unchanged by the refactor

The refactor MUST preserve SAML provisioning, dev-login, logout, and session
cookie behaviour exactly. The session payload shape, the email-as-account-key
resolution, the create-only SAML rule, and the dev-login resync rule MUST remain
as specified by `saml-provisioning`.

#### Scenario: SAML and dev-login sessions are identical before and after

- **GIVEN** the same SAML profile or dev-login role
- **WHEN** a session is built after the refactor
- **THEN** the resulting `UserSession` fields are identical to the pre-refactor
  session for the same input, except for any deadline change governed by
  `period-dual-state`
