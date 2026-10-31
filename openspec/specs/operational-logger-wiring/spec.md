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

### Requirement: Audit reporting failures MUST NOT change a mutation outcome

A failure of the audit log stream, of the audit drop metric or of the error log
written when a durable audit row is dropped MUST NOT change the result of the
mutation that was audited.

#### Scenario: the audit log stream throws

- **WHEN** a mutation succeeds and the audit log stream throws while recording it
- **THEN** the caller receives the mutation's own result

#### Scenario: reporting a dropped audit row fails

- **WHEN** a mutation succeeds, the durable audit write fails, and the drop metric or the error logger throws
- **THEN** the caller receives the mutation's own result

#### Scenario: the durable row is attempted independently

- **WHEN** the audit log stream throws
- **THEN** the durable audit row is still attempted
- **AND** when the audit log fails to report a lost record, one stderr line names the procedure and the lost sink

#### Scenario: a failed mutation keeps its own error

- **WHEN** a mutation fails with its own error and the audit sinks throw
- **THEN** the caller receives the mutation's original error code
