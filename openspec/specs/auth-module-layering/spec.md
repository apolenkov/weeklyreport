# auth-module-layering Specification

## Purpose

TBD - created by archiving change refactor-auth-exemplary-layering. Update Purpose after archive.

## Requirements

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
- **AND** because the new period's deadline is in the future, the factory
  materialises its `ReminderRule` rows via `applyToPeriod`, identically to the
  period-creator scheduler path (closing the Phase 50-A lazy-path asymmetry)
- **AND** the lead's `ReportSection` and per-project `ProjectStatus` rows are
  created by the report-section domain
- **AND** the auth module performs no `Report` / `ReportSection` / `ProjectStatus`
  create itself

#### Scenario: Lead login after the deadline does not schedule stale reminders

- **GIVEN** a lead whose first login of the week creates the period AFTER some of
  its reminder instants have already passed (e.g. a weekend first-login)
- **WHEN** the period factory creates that `Report`
- **THEN** it calls `applyToPeriod(period, now)`, passing the current time
- **AND** the applicator materialises only the reminder rules whose `fireAt` is
  still in the future and skips the already-elapsed ones — so a stale
  "deadline approaching" rule is never created active (the hourly scheduler fires
  any active past-due rule; it has no elapsed-`fireAt` guard), while a
  still-future instant such as a T+2h escalation is preserved

#### Scenario: A reminder-materialisation failure does not fail login

- **GIVEN** a lead login that creates the current period
- **WHEN** `applyToPeriod` throws (e.g. a transient DB error materialising the
  reminder rules)
- **THEN** the period creation still succeeds and the login completes — reminder
  materialisation is best-effort, so a secondary write never 500s the login
- **AND** the failure is logged, and the missing rules are recoverable via the
  reminder-policy backfill

#### Scenario: Lead login when the current-week period already exists

- **GIVEN** a `Report` already exists for the current week
- **WHEN** the lead logs in
- **THEN** the period factory returns the existing `Report` without creating a new one
- **AND** the lead's section is created in that existing `Report` if absent

#### Scenario: Concurrent creation races resolve without error

- **GIVEN** two concurrent creators (two lead logins, or a login racing the
  period-creator cron) that both find no current-week `Report`
- **WHEN** both attempt to create it
- **THEN** the partial-unique index `Report_one_open_per_boundary` lets one create
  succeed and the other receive a `P2002`
- **AND** the factory catches that `P2002`, re-reads, and returns the existing
  `Report` rather than throwing

#### Scenario: Concurrent same-lead login does not duplicate the section

- **GIVEN** the same lead logging in twice concurrently against one `Report`
- **WHEN** both calls reach `ensureLeadSection(reportId, userId)`
- **THEN** exactly one `ReportSection` exists for `(reportId, authorId)` afterwards
- **AND** neither call throws an unhandled unique-constraint error

### Requirement: Authentication behaviour is unchanged by the refactor

The refactor MUST preserve SAML provisioning, dev-login, logout, and session
cookie behaviour exactly. The session payload shape, the create-only SAML rule,
and the dev-login resync rule MUST remain as today. User resolution MUST move
verbatim: it stays email-first with the existing `samlId` fallback
(`findFirst({email}) ?? findFirst({samlId})`). This requirement does NOT assert
pure email-as-account-key resolution — the `samlId` fallback is a pre-existing
behaviour the `saml-provisioning` wording does not describe, and this change
neither removes nor reconciles it.

#### Scenario: SAML and dev-login sessions are identical before and after

- **GIVEN** the same SAML profile or dev-login role
- **WHEN** a session is built after the refactor
- **THEN** the resulting `UserSession` fields are identical to the pre-refactor
  session for the same input, except for any deadline change from the unified
  period factory

#### Scenario: The samlId resolution fallback is preserved

- **GIVEN** an existing user whose stored `email` does not match the incoming
  profile email but whose `samlId` does
- **WHEN** the session is built after the refactor
- **THEN** that existing user is resolved via the `samlId` fallback, exactly as
  before the refactor
