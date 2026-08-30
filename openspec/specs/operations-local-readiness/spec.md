# operations-local-readiness Specification

## Purpose

Ensure every repository-owned development and operations instruction agrees with executable configuration while keeping external production dependencies explicit.

## Requirements

### Requirement: Repository-owned operations instructions are executable

The repository-owned development and operations instructions, including Compose, observability, metrics, Grafana, SMTP, staging, and restore surfaces, MUST agree with the checked-in service graph, required environment variables, routes, credentials, and ownership declarations.

#### Scenario: A documented environment is rendered

- **WHEN** the documented example environment is supplied to its Compose stack
- **THEN** configuration rendering succeeds without a missing required variable or duplicate application port owner

#### Scenario: Native development starts from the repository root

- **WHEN** an operator copies the root `.env.example` to `.env` and runs the native API and Web package scripts
- **THEN** both processes load that root contract and the Web receives explicit server and public API origins without a second required env file

#### Scenario: An untouched production environment template is used

- **WHEN** an operator copies the tracked production template without filling its required empty values
- **THEN** Compose or runtime validation fails before a production service accepts traffic

#### Scenario: A production image is built

- **WHEN** CI or an operator builds the production API and Web images
- **THEN** one exact release version identifies telemetry, the user-visible Web build, and every repository-built image label and tag

#### Scenario: The observability overlay is composed

- **WHEN** the production stack is rendered with the repository observability overlay
- **THEN** the overlay supplies a collector endpoint and explicitly enables the telemetry SDK

#### Scenario: Development database configuration is rendered

- **WHEN** the development Compose stack is rendered
- **THEN** every database consumer uses the same fixed local-only credential without interpolating an arbitrary password into a URL
- **AND** application consumers target exact disposable PostgreSQL `customreport_e2e`
- **AND** an idempotent one-shot initializer ensures that database exists before migrations run
- **AND** a legacy named volume containing only `customreport_dev` upgrades without deleting the volume

#### Scenario: A fresh local product database is bootstrapped

- **WHEN** an operator supplies the exact per-run consent and an explicit seed profile after starting local PostgreSQL
- **THEN** one repository command verifies matching `DATABASE_URL` and `E2E_DATABASE_URL` targets
- **AND** it creates exact `customreport_e2e`, applies migrations, and seeds the profile in order
- **AND** every child operation repeats the exact guard before touching the database

#### Scenario: A local bootstrap step fails

- **WHEN** database creation, migration, or seeding exits non-zero
- **THEN** the bootstrap exits non-zero and executes no later step

#### Scenario: Development services publish host ports

- **WHEN** a development Compose file publishes PostgreSQL, Redis, Mailpit, API, or Web to the host
- **THEN** every published port binds explicitly to the loopback interface

#### Scenario: Native development listeners start

- **WHEN** the native API and Web development processes bind their configured ports
- **THEN** both listen only on `127.0.0.1` and a port collision fails without terminating an unrelated process
- **AND** container development binds those processes explicitly inside the private Compose network

#### Scenario: Production database identity is unsafe for a connection URL

- **WHEN** `DB_PASSWORD` contains a reserved URL character or `POSTGRES_DB` contains anything other than letters, digits, and underscores
- **THEN** the configuration guard exits non-zero without logging either value and no database-dependent service starts

#### Scenario: Metrics remain internal

- **WHEN** an operator follows the observability runbook
- **THEN** the documentation identifies the actual internal scrape path and does not claim a public Caddy `/metrics` route

#### Scenario: A destructive restore is requested

- **WHEN** the restore entrypoint receives a valid archive and exact target confirmation
- **THEN** it still executes nothing unless the exact per-run destructive consent is present

### Requirement: Local safety automation fails closed

The backup automation and its staleness healthcheck MUST validate positive
integer cadence inputs before arithmetic, looping, or filesystem work; the
backup loop MUST also validate retention. A completed dump MUST become visible
only after its atomic publish succeeds, and success logging or retention
pruning MUST NOT run after a failed publish. Repository post-update hooks MUST
propagate dependency-install or generated-client failures to their caller.

#### Scenario: Backup cadence is invalid

- **WHEN** cadence or retention is empty, zero, negative, or non-numeric
- **THEN** the backup process exits non-zero before entering a hot loop or deleting backups

#### Scenario: Backup health cadence is invalid

- **WHEN** the backup healthcheck receives an empty, zero, negative, or non-numeric cadence
- **THEN** it exits non-zero before arithmetic or filesystem inspection and cannot report a stale backup target as healthy

#### Scenario: A completed dump cannot be published

- **WHEN** `pg_dump` succeeds but the atomic rename from the partial path fails
- **THEN** the loop reports the publish failure, removes the partial file, and does not log success or prune retained dumps

#### Scenario: A post-update hook command fails

- **WHEN** dependency installation or generated-client refresh fails
- **THEN** the Git hook exits non-zero and exposes the failed step

### Requirement: Repository-owned runtime surfaces are bounded and reproducible

The production browser telemetry tunnel MUST enforce a bounded per-client quota, and the production backup service MUST run reviewed backup, health, and restore entrypoints baked into its image rather than host bind mounts.

#### Scenario: Browser telemetry exceeds its local quota

- **WHEN** one client exceeds the fixed request window or the bounded client registry is full
- **THEN** the tunnel rejects excess envelopes without forwarding them or growing unbounded process state

#### Scenario: An oversized telemetry body starts streaming

- **WHEN** a request has no trustworthy oversized `Content-Length` and begins streaming beyond the body limit
- **THEN** the tunnel rejects it and charges the attempt to the admission quota so invalid streams cannot bypass the resource bound

#### Scenario: The backup container starts

- **WHEN** the production backup service is built and run
- **THEN** all recovery entrypoints come from the reviewed image and no mutable host script is mounted over them

### Requirement: External production controls are not simulated

The repository-owned operations documentation and readiness checks MUST identify alert receivers, off-host encrypted backup storage, scheduled restore drills, platform protection, immutable artifacts, and release records as unproven until their external systems provide read-back evidence.

#### Scenario: Only local configuration passes

- **WHEN** all repository-owned operations checks pass but an external receiver or recovery target has no read-back proof
- **THEN** local readiness is PASS and the external prerequisite remains BLOCKED rather than being reported as complete
