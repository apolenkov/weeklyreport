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
reseed resolver uses `PATH` only to locate an executable. The seven variables
identified by the coverage audit —
`SENTRY_DSN`, `CLIENT_LOG_FORWARDING`, `AUTH_DEV_MODE_ALLOW_TEST`,
`CUSTOMREPORT_REPO_ROOT`, `TG_BOT_TOKEN`, `DLQ_ALERT_THRESHOLD`, and
`AUTH_JWT_COOKIE_NAME` — MUST each be added.

The literal-`process.env.<NAME>` grep is a necessary but not sufficient check: a
var read through a factory that receives `process.env` as a parameter (e.g.
`AUTH_JWT_COOKIE_NAME`, read as `env.AUTH_JWT_COOKIE_NAME` inside
`resolveSessionCookieName(env)`) is invisible to it. That factory-passed-env
blind spot MUST be closed by auditing the sanctioned factory sites by hand; this
change declares `AUTH_JWT_COOKIE_NAME` (found by that audit, not the grep) to
prove the point.

#### Scenario: Every consumed var is declared

- **GIVEN** a var such as `TG_BOT_TOKEN` is read via `process.env` in
  `apps/api/src` outside test/test-utils code
- **WHEN** `env.schema.ts` is inspected for that key
- **THEN** the key is present in the `envSchema` object shape
- **AND** the coverage grep over `apps/api/src` reports zero undeclared keys

#### Scenario: A factory-passed-env var is caught by the manual audit

- **GIVEN** `AUTH_JWT_COOKIE_NAME` is read as `env.AUTH_JWT_COOKIE_NAME` inside
  `resolveSessionCookieName`, never as a literal `process.env.AUTH_JWT_COOKIE_NAME`
- **WHEN** the sanctioned `process.env`-consuming factories are audited by hand
- **THEN** the var is found and declared `.optional()` in `envSchema`
- **AND** the coverage requirement records that the grep alone cannot see it

### Requirement: Declared vars obey the no-default posture

The system MUST NOT attach a `.default()` to any product-config field in
`envSchema`; a value that is mandatory to run MUST be declared REQUIRED (no
default, so boot fails loud on absence), and a genuinely-optional feature MUST
be declared `.optional()` (no default) with the consumer handling absence. The
seven added vars are all genuinely optional and MUST be `.optional()`, each
mapped to the existing precedent for its shape: `SENTRY_DSN` and `TG_BOT_TOKEN`
follow the optional-string form (`OTEL_EXPORTER_OTLP_ENDPOINT`);
`DLQ_ALERT_THRESHOLD` follows the optional-coerced-number form (`DB_POOL_MAX`)
with the consumer applying its named `DEFAULT_THRESHOLD` constant;
`CLIENT_LOG_FORWARDING`, `AUTH_DEV_MODE_ALLOW_TEST`, `CUSTOMREPORT_REPO_ROOT`,
and `AUTH_JWT_COOKIE_NAME` are optional strings (dev/test-only toggles,
overrides, and a named-default cookie name).

#### Scenario: No default is introduced

- **WHEN** `env.schema.ts` is scanned for `.default(`
- **THEN** no product-config field carries a `.default()`
- **AND** each of the seven added vars is declared `.optional()` with no default

#### Scenario: A missing required var fails boot loud

- **GIVEN** an existing REQUIRED var (e.g. `AUTH_JWT_SECRET`) is unset
- **WHEN** the API boots and `ConfigModule` runs `validateEnv()`
- **THEN** `safeParse` fails and the process exits non-zero with the invalid-config report
- **AND** the failure occurs at startup, not at a later request or worker job

### Requirement: Routed vars read through the validated config except at named boundaries

The system MUST read the vars this change routes through the validated
`EnvConfig` — injected via the `ENV_CONFIG` token, a locally validated `env`,
or a constructor/parameter that already carries `EnvConfig` — rather than
reaching for raw `process.env`. The routed set is exactly these seven vars,
each with a single reachable validated view: `CLIENT_LOG_FORWARDING` (the
`main.ts` local `validateEnv()` result), `DLQ_ALERT_THRESHOLD`
(`dlq-monitor.service.ts` via injected `ENV_CONFIG`), `TG_BOT_TOKEN` +
`CUSTOMREPORT_REPO_ROOT` (the tRPC router via an `EnvConfig` threaded onto
`RouterDeps`), `LOG_LEVEL` (`prisma.service.ts`, via the `env: EnvConfig`
already stored on the constructed instance), `PDF_OUTPUT_DIR`
(`pdf-export.processor.ts`, via the `env` field its base class
`RawBullMqProcessor` already stores), and `BULLMQ_PREFIX`
(`getBullMQConnectionOptions`/`getBullMQOptions` in `bullmq-options.ts`, via
the `env: EnvConfig` parameter each function already receives).

Raw `process.env` access remains permitted at these enumerated boundaries,
which run before or outside the Nest DI container: the single
`envSchema.safeParse(process.env)` entry point in `env.schema.ts`; the
`Sentry.init` at `main.ts` module load, which executes before
`validateEnv()` is called; the second `validateEnv()` at the BullMQ
`worker-observability.ts` process boundary; and factory functions whose
default parameter is `env: NodeJS.ProcessEnv = process.env`
(`createAuthController`, `createSamlStrategyOptions`, `otel.bootstrap`,
`resolveSessionCookieName`); and `createServiceLogger` in
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

- **GIVEN** `main.ts` initialises Sentry at module load before `validateEnv()` runs
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

### Requirement: A single Telegram-configured predicate replaces duplicated token checks

The system MUST expose an `isTelegramConfigured(env: EnvConfig): boolean` helper
in `apps/api/src/lib/env.ts` (beside `requireEnv`) that returns whether a
non-empty `TG_BOT_TOKEN` is present (keyed on `env.TG_BOT_TOKEN?.trim()` being
non-empty). The two sites that currently hand-roll `TG_BOT_TOKEN?.trim() ?? ""`
— the tRPC router's `integrationsStatus` query and `telegram.module.ts` — MUST
call this helper instead of duplicating the check, which requires an `EnvConfig`
to be reachable at both sites.

#### Scenario: Telegram adapter selection uses the helper

- **GIVEN** `TG_BOT_TOKEN` is unset or blank
- **WHEN** `telegram.module.ts` selects an adapter
- **THEN** `isTelegramConfigured(env)` returns `false` and the mock adapter is chosen

#### Scenario: A configured token is detected once

- **GIVEN** `TG_BOT_TOKEN` holds a non-blank value
- **WHEN** either the router `integrationsStatus` query or module wiring checks configuration
- **THEN** both call `isTelegramConfigured(env)` and observe `true`, with no duplicated inline check
