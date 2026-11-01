# operations-local-readiness Specification

## Purpose

Ensure repository-owned local dependency manifests and production Helm operations instructions agree with their service graphs and recovery entrypoints while keeping external production dependencies explicit.

## Requirements

### Requirement: Repository-owned operations instructions are executable

The repository-owned development and production instructions, including
the local dependency manifest, production Helm, SMTP, database, backup, and restore surfaces, MUST agree with the
checked-in service graph, required environment variables, routes, credentials,
and ownership declarations.

#### Scenario: A documented environment is rendered

- **WHEN** the documented development environment is supplied to the native processes, or the documented production values are supplied to Helm
- **THEN** configuration rendering succeeds without a missing required input or duplicate application port owner

#### Scenario: Native development starts from the repository root

- **WHEN** an operator copies the root `.env.example` to `.env` and runs the native API and Web package scripts
- **THEN** both processes load that root contract and the Web receives explicit server and public API origins without a second required env file

#### Scenario: Required production configuration is absent

- **WHEN** an operator renders the production Helm chart with any required value absent or empty where non-empty input is required
- **THEN** Helm validation fails before a production workload is created

#### Scenario: A production image is built

- **WHEN** CI or an operator builds the production API and Web images
- **THEN** one exact release version identifies telemetry, the user-visible Web build, and every repository-built image label and tag

#### Scenario: Development database configuration is rendered

- **WHEN** the local dependency manifest is read
- **THEN** every database consumer uses the same fixed local-only credential without interpolating an arbitrary password into a URL
- **AND** application consumers target exact disposable PostgreSQL `weeklyreport_e2e`
- **AND** the guarded local bootstrap creates the configured `POSTGRES_DB`
  database when it does not yet exist before migrations run

#### Scenario: A fresh local product database is bootstrapped

- **WHEN** an operator supplies the exact per-run consent and an explicit seed profile after starting local PostgreSQL
- **THEN** one repository command verifies matching `DATABASE_URL` and `E2E_DATABASE_URL` targets
- **AND** it validates the configured `POSTGRES_DB` target, creates that exact
  disposable database, applies migrations, and seeds the profile in order
- **AND** every child operation repeats the exact guard before touching the database

#### Scenario: A local bootstrap step fails

- **WHEN** database creation, migration, or seeding exits non-zero
- **THEN** the bootstrap exits non-zero and executes no later step

#### Scenario: Development services publish host ports

- **WHEN** the local dependency manifest publishes PostgreSQL, Redis, Mailpit, or Gotenberg to the host
- **THEN** each is a LoadBalancer Service that OrbStack exposes on localhost only, at the documented port

#### Scenario: Native development listeners start

- **WHEN** the native API and Web development processes bind their configured ports
- **THEN** both listen only on `127.0.0.1` and a port collision fails without terminating an unrelated process

#### Scenario: Production database identity is unsafe for a connection URL

- **WHEN** `postgres.db` contains anything other than letters, digits, and underscores, or a values-supplied `DB_PASSWORD` contains a reserved URL character
- **THEN** Helm rendering fails without logging either value
- **AND** an unsafe password supplied through an existing Secret is rejected by the migration initContainer before its first database connection, so the API cannot start

#### Scenario: Metrics remain private

- **WHEN** an operator requests the production Caddy `/metrics` path
- **THEN** the edge does not expose the API metrics endpoint

#### Scenario: A destructive restore is requested

- **WHEN** the restore entrypoint receives a valid archive and exact target confirmation
- **THEN** it still executes nothing unless the exact per-run destructive consent is present

### Requirement: Local safety automation fails closed

The backup automation and its staleness healthcheck MUST validate positive
integer cadence inputs before arithmetic, looping, or filesystem work; the
backup loop MUST also validate retention. A completed dump MUST become visible
only after its atomic publish succeeds, and success logging or retention
pruning MUST NOT run after a failed publish.

#### Scenario: Backup cadence is invalid

- **WHEN** cadence or retention is empty, zero, negative, or non-numeric
- **THEN** the backup process exits non-zero before entering a hot loop or deleting backups

#### Scenario: Backup health cadence is invalid

- **WHEN** the backup healthcheck receives an empty, zero, negative, or non-numeric cadence
- **THEN** it exits non-zero before arithmetic or filesystem inspection and cannot report a stale backup target as healthy

#### Scenario: A completed dump cannot be published

- **WHEN** `pg_dump` succeeds but the atomic rename from the partial path fails
- **THEN** the loop reports the publish failure, removes the partial file, and does not log success or prune retained dumps

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

### Requirement: Backup publication preserves complete dumps across runs

`backup-loop.sh` MUST use a unique temporary file per run and publish completed
dumps under the dated `weeklyreport-*.dump` pattern without replacing an existing
dump. Failure to reserve or publish the file, including a silently skipped
non-clobber move, MUST fail the run without success logging or retention pruning.

#### Scenario: Two one-shot backups share a timestamp

- **WHEN** two `BACKUP_RUN_ONCE=true` runs complete with the same timestamp
- **THEN** two distinct complete dumps remain with both payloads intact
- **AND** each published filename remains discoverable by health and retention

#### Scenario: Publication encounters an existing dump

- **WHEN** the destination already contains a complete dump
- **THEN** the existing dump is preserved and the new run fails
- **AND** the run removes only its own temporary file and does not prune or log success

#### Scenario: Temporary-file reservation fails

- **WHEN** the temporary file cannot be reserved
- **THEN** the run fails without calling pg_dump or pruning retained files

### Requirement: Newly created backup artifacts have private filesystem modes

`backup-loop.sh` MUST apply umask 077 before creating backup artifacts. Newly
created directories MUST have mode 0700 and temporary and complete dump files
MUST have mode 0600. Existing mounted directory permissions MUST remain unchanged.
The existing PGPASSWORD environment contract remains supported.

#### Scenario: A new backup directory is created

- **WHEN** a successful run creates its backup directory
- **THEN** the directory mode is 0700
- **AND** its temporary and completed dump modes are 0600

#### Scenario: A mounted backup directory already exists

- **WHEN** a run uses an existing backup directory with mode 0775
- **THEN** that directory retains mode 0775
- **AND** the run's temporary and completed dumps have mode 0600

### Requirement: Backup start sweeps abandoned partial files under the writer lock

After `backup-loop.sh` acquires the writer lock and before it takes its first
dump, it MUST remove every `weeklyreport-*.partial*` file in `BACKUP_DIR`. Those
files are left by passes that were killed by SIGKILL, lost to a crash or power
failure, or otherwise did not finish. The held lock excludes any live writer, so
no partial file in the directory can belong to an active pass. The sweep MUST
NOT run, and MUST NOT remove any file, when the lock is not acquired. Completed
`weeklyreport-*.dump` files MUST NOT be removed by the sweep, and their
retention MUST keep its current behavior.

#### Scenario: Lock acquired at start

- **WHEN** the backup process acquires the writer lock while stale `weeklyreport-*.partial*` files remain in `BACKUP_DIR`
- **THEN** every such partial file is removed before the first `pg_dump` of the process
- **AND** a completed `weeklyreport-*.dump` within retention remains in `BACKUP_DIR`

#### Scenario: Lock held by another writer

- **WHEN** another backup writer holds the writer lock and the process starts
- **THEN** the process exits 75 without removing any partial file from `BACKUP_DIR`

#### Scenario: Retention of completed dumps is unchanged

- **WHEN** a dump pass completes after the start-time sweep
- **THEN** completed dumps older than the retention window are pruned as before
- **AND** the start-time sweep does not remove any completed dump
