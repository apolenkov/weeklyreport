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

### Requirement: API listener ownership is explicit

`API_HOST` MUST be required and accept only `127.0.0.1` or `0.0.0.0`. Native
development MUST supply loopback; container environments MUST supply the
container-network listener explicitly. The API bootstrap MUST pass the
validated address to `app.listen` rather than relying on the framework default.

#### Scenario: API host is absent or ambiguous

- **WHEN** `API_HOST` is missing or names an unsupported hostname or address
- **THEN** environment validation fails before the API listener starts

#### Scenario: API starts in a declared network boundary

- **WHEN** the API bootstrap receives a valid `PORT` and `API_HOST`
- **THEN** it binds exactly that address and port
