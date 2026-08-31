## Purpose

Ensure Nest service DI factories wire the shared operational logger for every
service that emits operational events.

## Requirements

### Requirement: Service DI factories inject the shared APP_LOGGER

Nest module factories MUST inject the `APP_LOGGER` token (exported by
`ConfigModule`) and pass it through for every operational service that accepts
an `AppLogger` constructor argument. This covers the focused admin services
(`SnapshotAdminService`, `ProjectAdminService`, `ReminderAdminService`, and
`PeriodAdminService`), `PdfExportService`, and `RemindersService`, mirroring
the pattern used by `period.module.ts` for `PeriodService` and its schedulers.

#### Scenario: Admin service factories resolve the shared logger

- **GIVEN** `AdminModule` is bootstrapped in the Nest application
- **WHEN** the DI container resolves a focused admin service provider
- **THEN** its factory injects `APP_LOGGER` and constructs the service with
  that logger, not `undefined`

#### Scenario: PdfExportService factory resolves the shared logger

- **GIVEN** `PdfExportModule` is bootstrapped in the Nest application
- **WHEN** the DI container resolves the `PdfExportService` provider
- **THEN** the factory injects `APP_LOGGER` and constructs `PdfExportService`
  with that logger as its second argument, not `undefined`

#### Scenario: RemindersService factory resolves the shared logger

- **GIVEN** `RemindersModule` is bootstrapped in the Nest application
- **WHEN** the DI container resolves the `RemindersService` provider
- **THEN** the factory injects `APP_LOGGER` and constructs `RemindersService`
  with that logger as its second argument, not `undefined`

#### Scenario: Direct construction outside DI still defaults safely

- **GIVEN** a unit test constructs `PeriodAdminService` or `RemindersService`
  directly without passing a logger
- **WHEN** the constructor runs
- **THEN** that service still falls back to its existing null logger default

#### Scenario: Required logger constructors stay explicit

- **GIVEN** a unit test constructs `SnapshotAdminService`,
  `ProjectAdminService`, `ReminderAdminService`, or `PdfExportService`
- **WHEN** the constructor is called
- **THEN** the caller supplies the logger explicitly because those constructors
  do not provide a null-logger fallback
