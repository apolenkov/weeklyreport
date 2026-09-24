# env-schema-coverage Specification

## Purpose

Declare every API environment variable in one validated schema, fail boot when mandatory configuration is absent, and route reads through validated configuration without silent defaults.

## Requirements

### Requirement: Every consumed env var is declared in the validated schema

The system MUST declare every product-config environment variable the
`apps/api` runtime reads in `apps/api/src/infrastructure/config/env.schema.ts`
(`envSchema`), so that a missing or malformed value is caught by one Zod parse
rather than at a scattered raw read. A grep of `apps/api/src` (excluding
`*.spec.ts`, `*.test.ts`, and `test-utils/*`) for a literal `process.env.<NAME>`
read MUST NOT surface a product-config `<NAME>` absent from `envSchema`.
Inherited process-runtime variables such as `PATH` are not product
configuration and stay at their explicit operating-system boundary: the dev
reseed resolver uses `PATH` only to locate an executable. The current
product-config variables, including
`SENTRY_DSN`, `CLIENT_LOG_FORWARDING`, `AUTH_DEV_MODE_ALLOW_TEST`,
`CUSTOMREPORT_REPO_ROOT`, and `DLQ_ALERT_THRESHOLD` MUST each be declared.

The literal-`process.env.<NAME>` grep is necessary but not sufficient: a value
read through a factory parameter is invisible to it. The sanctioned factories
and bootstrap boundaries MUST therefore be reviewed alongside the grep, with
each product-config value accounted for in the schema or in the explicit raw
boundary list below. This prevents an indirect read from bypassing startup
validation.

#### Scenario: Every consumed var is declared

- **GIVEN** a covered product-config var is read via `process.env` in
  `apps/api/src` outside test/test-utils code
- **WHEN** `env.schema.ts` is inspected for that key
- **THEN** the key is present in the `envSchema` object shape
- **AND** the coverage grep over `apps/api/src` reports zero undeclared keys

### Requirement: Declared vars obey the no-default posture

The system MUST NOT attach a `.default()` to any product-config field in
`envSchema`; a value that is mandatory to run MUST be declared REQUIRED (no
default, so boot fails loud on absence), and a genuinely-optional feature MUST
be declared `.optional()` (no default) with the consumer handling absence. The
optional variables are genuinely optional and MUST be `.optional()`, each
mapped to the existing precedent for its shape: `SENTRY_DSN` follows the
optional-string form (`OTEL_EXPORTER_OTLP_ENDPOINT`);
`DLQ_ALERT_THRESHOLD` follows the optional-coerced-number form
with the consumer applying its named `DEFAULT_THRESHOLD` constant;
`CLIENT_LOG_FORWARDING`, `AUTH_DEV_MODE_ALLOW_TEST`, and
`CUSTOMREPORT_REPO_ROOT` are optional strings (dev/test-only toggles and
overrides).

#### Scenario: No default is introduced

- **WHEN** `env.schema.ts` is scanned for `.default(`
- **THEN** no product-config field carries a `.default()`
- **AND** each optional variable is declared `.optional()` with no default

#### Scenario: A missing required var fails boot loud

- **GIVEN** an existing REQUIRED var (e.g. `AUTH_JWT_SECRET`) is unset
- **WHEN** the API boots and `ConfigModule` runs `validateEnv()`
- **THEN** `safeParse` fails and the process exits non-zero with the invalid-config report
- **AND** the failure occurs at startup, not at a later request or worker job

#### Scenario: Blank required numeric settings, Redis host, or PDF directory fail boot loud

- **GIVEN** all other configuration is valid
- **WHEN** `REDIS_HOST`, `REDIS_DB`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`,
  `REPORT_ASSISTANT_SIMILARITY_THRESHOLD`, or `PDF_OUTPUT_DIR` is an empty string
  or contains only whitespace, including tabs and newlines
- **THEN** validation fails at startup instead of coercing a blank value to zero
  or accepting a blank Redis host or output directory
- **AND** explicit numeric `"0"` remains valid for each of the four numeric settings,
  with their existing range and integer constraints preserved
- **AND** nonblank relative and absolute `PDF_OUTPUT_DIR` paths remain accepted unchanged
- **AND** nonblank `REDIS_HOST` values remain accepted unchanged

### Requirement: Routed vars read through the validated config except at named boundaries

The system MUST read the routed variables through the validated
`EnvConfig` — injected via the `ENV_CONFIG` token, a locally validated `env`,
or a constructor/parameter that already carries `EnvConfig` — rather than
reaching for raw `process.env`. The routed set includes the three required
database pool settings and these existing variables,
each with a single reachable validated view: `DB_POOL_MAX`,
`DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS` (the Prisma pool
constructor), `CLIENT_LOG_FORWARDING` (the
`main.ts` local `validateEnv()` result), `DLQ_ALERT_THRESHOLD`
(`dlq-monitor.service.ts` via injected `ENV_CONFIG`), `CUSTOMREPORT_REPO_ROOT`
(the tRPC router via an `EnvConfig` threaded onto
`AppRouterDeps`), `LOG_LEVEL` (`prisma.service.ts`, via the `env: EnvConfig`
already stored on the constructed instance), `PDF_OUTPUT_DIR`
(`pdf-export.processor.ts`, via the `env` field its base class
`RawBullMqProcessor` already stores).

Raw `process.env` access remains permitted at these enumerated boundaries,
which run before or outside the Nest DI container: the single
`envSchema.safeParse(process.env)` entry point in `env.schema.ts`; the dynamic
`sentry-bootstrap` import inside `start()`; the second `validateEnv()` at the
BullMQ `worker-observability.ts` process boundary; the API auth-ingress
bootstrap that passes `process.env` into the validated auth/SAML factories;
`otel.bootstrap`; and `createServiceLogger` in
`logger-service.ts`, a pre-DI logger factory that parses
`process.env.LOG_LEVEL` through `logLevelSchema.parse` (throws on an invalid
value — validated, no silent fallback) before the container exists. `AUTH_DEV_MODE_ALLOW_TEST` is declared for
coverage but read raw beside its `NODE_ENV` and `AUTH_DEV_MODE`
dev-mode-gate siblings (both already declared, both read raw); routing one
of the three buys no safety once it is declared, so all three stay raw.

#### Scenario: A routed var reads from the validated config

- **GIVEN** `dlq-monitor.service.ts` reads `DLQ_ALERT_THRESHOLD` after the DI
  container is available
- **WHEN** it needs the threshold value
- **THEN** it reads from the injected `EnvConfig`, not raw `process.env`

#### Scenario: A sanctioned bootstrap read is allowed

- **GIVEN** `start()` dynamically loads Sentry at the validated bootstrap boundary
- **WHEN** it reads `SENTRY_DSN` via raw `process.env`
- **THEN** that read is permitted because no validated `env` exists at that point

#### Scenario: A constructor-carried EnvConfig is read instead of a fresh raw lookup

- **GIVEN** `PdfExportProcessor` already receives `env: EnvConfig` through
  its base class `RawBullMqProcessor`, and `PDF_OUTPUT_DIR` is a REQUIRED
  schema field with no default
- **WHEN** the processor resolves the output directory for a rendered PDF
- **THEN** it reads `this.env.PDF_OUTPUT_DIR` directly, with no `??` fallback
  string and no fresh `process.env.PDF_OUTPUT_DIR` read

### Requirement: Production boot requires SAML config when dev-login is disabled

The system MUST fail boot when `NODE_ENV` is `production` and `AUTH_DEV_MODE`
is `false` and any of `KEYCLOAK_SAML_CALLBACK_URL`,
`KEYCLOAK_SAML_ENTRY_POINT`, `KEYCLOAK_SAML_ISSUER`, `KEYCLOAK_SAML_CERT` is
absent or blank. This mirrors the existing `SMTP_HOST`/`SMTP_FROM`
production fence in the same `superRefine` block. Without this fence, a prod
boot without SAML config succeeds and the deploy looks healthy until the
first user attempts to log in, when `saml.strategy.ts`'s own `requireEnv`
call fails late.

#### Scenario: Missing SAML config fails boot loud

- **GIVEN** `NODE_ENV=production`, `AUTH_DEV_MODE=false`, and
  `KEYCLOAK_SAML_ISSUER` is unset
- **WHEN** `validateEnv()` runs
- **THEN** `safeParse` fails with an issue naming `KEYCLOAK_SAML_ISSUER`
- **AND** the process exits non-zero before the SAML strategy is constructed

#### Scenario: Complete SAML config passes production boot

- **GIVEN** `NODE_ENV=production`, `AUTH_DEV_MODE=false`, and all four
  `KEYCLOAK_SAML_*` vars are set to non-blank values
- **WHEN** `validateEnv()` runs
- **THEN** `safeParse` succeeds and the API boots

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
