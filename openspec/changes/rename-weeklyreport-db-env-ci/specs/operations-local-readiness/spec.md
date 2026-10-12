# Spec Delta

## MODIFIED Requirements

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
