# env-schema-coverage Delta Specification

## ADDED Requirements

### Requirement: Production boot requires complete delivery and release identity

The system MUST fail boot in production unless `SMTP_HOST`, `SMTP_PORT`, and
`SMTP_FROM` are all present and `OTEL_SERVICE_VERSION` names the exact deployed
release. Development and test MAY omit these values and use their explicit
local consumer behavior.

#### Scenario: Production SMTP port is absent

- **GIVEN** all other production configuration is valid and `SMTP_PORT` is unset
- **WHEN** `validateEnv()` runs
- **THEN** validation fails before the reminder transport is constructed

#### Scenario: Production release identity is absent

- **GIVEN** `NODE_ENV=production` and `OTEL_SERVICE_VERSION` is unset or blank
- **WHEN** `validateEnv()` runs
- **THEN** validation fails even when telemetry export is currently disabled
