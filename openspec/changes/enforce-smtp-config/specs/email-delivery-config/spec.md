## ADDED Requirements

### Requirement: EmailService MUST resolve SMTP config from injected EnvConfig

`EmailService` (`apps/api/src/infrastructure/email/email.service.ts`) MUST
obtain all SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_FROM`) from a validated `EnvConfig` injected through Nest DI,
and MUST NOT read `process.env` directly. The `EnvConfig` MUST be exposed as a
Nest provider built from `validateEnv()` (e.g. `useFactory`), so the container
shares one validated source of truth and tests inject config without mutating
`process.env`.

#### Scenario: Service reads SMTP settings from injected config

- **WHEN** `EmailService` is constructed by the Nest DI container
- **THEN** it receives the validated `EnvConfig` as a constructor dependency
- **AND** it derives the from-address and transport options from that config,
  not from `process.env`

#### Scenario: Tests provide config via DI

- **WHEN** an integration test instantiates `EmailService`
- **THEN** it supplies an `EnvConfig` value through the test module provider
- **AND** the test does not assign to `process.env.SMTP_*` to influence behavior

### Requirement: Transport selection MUST follow the injected config

`EmailService` MUST create a real nodemailer SMTP transport when the injected
`EnvConfig.SMTP_HOST` is set, and MUST use `jsonTransport` (dev/no-delivery)
only when `SMTP_HOST` is absent. Because the production env fence requires
`SMTP_HOST`, the `jsonTransport` branch MUST be unreachable in production.

#### Scenario: Host configured selects real SMTP transport

- **WHEN** `EmailService` is constructed with an `EnvConfig` whose `SMTP_HOST`
  is set
- **THEN** it builds a nodemailer SMTP transport targeting that host and port
- **AND** it does not select `jsonTransport`

#### Scenario: Host absent selects jsonTransport for non-production

- **WHEN** `EmailService` is constructed with an `EnvConfig` whose `SMTP_HOST`
  is unset (a state only reachable outside production)
- **THEN** it builds a `jsonTransport` transport and logs the payload instead of
  delivering
