## Purpose

Ensure Nest service providers supply the shared operational logger as a
required dependency for every covered service that emits operational events.

## Requirements

### Requirement: Operational service providers require the shared APP_LOGGER

Production Nest providers MUST resolve the existing `APP_LOGGER` token
exported by `ConfigModule` and supply it as a required constructor dependency
for the focused admin services (`SnapshotAdminService`, `ProjectAdminService`,
`ReminderAdminService`, and `PeriodAdminService`), `PdfExportService`, and
`RemindersService`. Factory providers MUST resolve the token through their
`inject` arrays; native class providers MUST resolve it through
`@Inject(APP_LOGGER)`. These constructors MUST require an explicit logger
both in production composition and in direct construction, with no silent
null-logger fallback.

#### Scenario: Admin service providers resolve the shared logger

- **GIVEN** `AdminModule` is bootstrapped in the Nest application
- **WHEN** the DI container resolves a focused admin service provider
- **THEN** its provider supplies the token-resolved `APP_LOGGER` to the
  service constructor, not `undefined`

#### Scenario: PdfExportService provider resolves the shared logger

- **GIVEN** `PdfExportModule` is bootstrapped in the Nest application
- **WHEN** the DI container resolves the `PdfExportService` provider
- **THEN** its class provider supplies the shared `APP_LOGGER` through
  `@Inject(APP_LOGGER)` as the required second constructor argument,
  not `undefined`

#### Scenario: RemindersService provider resolves the shared logger

- **GIVEN** `RemindersModule` is bootstrapped in the Nest application
- **WHEN** the DI container resolves the `RemindersService` provider
- **THEN** its class provider supplies the shared `APP_LOGGER` through
  `@Inject(APP_LOGGER)` as the required second constructor argument,
  not `undefined`

#### Scenario: Direct construction requires the logger

- **GIVEN** a unit test constructs `PeriodAdminService` or `RemindersService`
  directly without passing a logger
- **WHEN** TypeScript checks the constructor call
- **THEN** it rejects the missing required logger argument
- **AND** neither constructor supplies a null-logger default

#### Scenario: Required logger constructors stay explicit

- **GIVEN** a unit test constructs `SnapshotAdminService`,
  `ProjectAdminService`, `ReminderAdminService`, or `PdfExportService`
- **WHEN** the constructor is called
- **THEN** the caller supplies the logger explicitly because those constructors
  do not provide a null-logger fallback
