# env-schema-coverage Specification

## Purpose

TBD - created by archiving change complete-env-schema-coverage. Update Purpose after archive.

## Requirements

### Requirement: Every consumed env var is declared in the validated schema

The system MUST declare every environment variable the `apps/api` runtime reads
in `apps/api/src/infrastructure/config/env.schema.ts` (`envSchema`), so that a
missing or malformed value is caught by one Zod parse rather than at a scattered
raw read. A grep of `apps/api/src` (excluding `*.spec.ts`, `*.test.ts`, and
`test-utils/*`) for a literal `process.env.<NAME>` read MUST NOT surface a
`<NAME>` absent from `envSchema`. The seven currently-undeclared vars —
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
`EnvConfig` — injected via the `ENV_CONFIG` token or read from a locally
validated `env` — rather than reaching for raw `process.env`. The routed set is
exactly the four vars with a single reachable validated view:
`CLIENT_LOG_FORWARDING` (the `main.ts` local `validateEnv()` result),
`DLQ_ALERT_THRESHOLD` (`dlq-monitor.service.ts` via injected `ENV_CONFIG`), and
`TG_BOT_TOKEN` + `CUSTOMREPORT_REPO_ROOT` (the tRPC router via an `EnvConfig`
threaded onto `RouterDeps`).

Raw `process.env` access remains permitted at these enumerated boundaries, which
run before or outside the Nest DI container: the single
`envSchema.safeParse(process.env)` entry point in `env.schema.ts`; the
`Sentry.init` at `main.ts` module load, which executes before `validateEnv()` is
called; the second `validateEnv()` at the BullMQ `worker-observability.ts`
process boundary; and factory functions whose default parameter is
`env: NodeJS.ProcessEnv = process.env` (`createAuthController`,
`createSamlStrategyOptions`, `otel.bootstrap`, `resolveSessionCookieName`).
`AUTH_DEV_MODE_ALLOW_TEST` is declared for coverage but read raw beside its
`NODE_ENV` and `AUTH_DEV_MODE` dev-mode-gate siblings (both already declared,
both read raw); routing one of the three buys no safety once it is declared, so
all three stay raw and are swept together by the separate follow-up that routes
the remaining already-declared raw reads (`LOG_LEVEL`, `LOG_DIR`, `NODE_ENV`,
`AUTH_DEV_MODE`, `PDF_EXPORT_JWT_SECRET`, `PDF_OUTPUT_DIR`, `BULLMQ_PREFIX`) —
out of scope here.

#### Scenario: A routed var reads from the validated config

- **GIVEN** `dlq-monitor.service.ts` reads `DLQ_ALERT_THRESHOLD` after the DI
  container is available
- **WHEN** it needs the threshold value
- **THEN** it reads from the injected `EnvConfig`, not raw `process.env`

#### Scenario: A sanctioned bootstrap read is allowed

- **GIVEN** `main.ts` initialises Sentry at module load before `validateEnv()` runs
- **WHEN** it reads `SENTRY_DSN` via raw `process.env`
- **THEN** that read is permitted because no validated `env` exists at that point

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
