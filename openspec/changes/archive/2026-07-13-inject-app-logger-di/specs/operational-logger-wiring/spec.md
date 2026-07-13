## ADDED Requirements

### Requirement: Service DI factories inject the shared APP_LOGGER

Nest module factories MUST inject the `APP_LOGGER` token (exported by
`ConfigModule`) and pass it through for any service that accepts an
optional `AppLogger` constructor argument, instead of leaving the argument
unset and letting the service fall back to a no-op null logger. This
applies to `AdminService`, `PdfExportService`, and `RemindersService`,
mirroring the pattern `period.module.ts` already uses for `PeriodService`
and its schedulers.

#### Scenario: AdminService factory resolves the shared logger

- **GIVEN** `AdminModule` is bootstrapped in the Nest application
- **WHEN** the DI container resolves the `AdminService` provider
- **THEN** the factory injects `APP_LOGGER` and constructs `AdminService`
  with that logger, not `undefined`

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

- **GIVEN** a unit test constructs `AdminService`, `PdfExportService`, or
  `RemindersService` directly without passing a logger
- **WHEN** the constructor runs
- **THEN** the service still falls back to its existing null logger default,
  so tests are unaffected by this requirement
