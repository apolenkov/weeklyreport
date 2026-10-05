## Purpose

`prisma/guards/_destructive-guard.ts` exports the exact disposable-target APIs
`assertE2eRuntimeDestructive` and `assertE2eRuntimeDestructiveTarget`, called
immediately before destructive E2E/runtime database work. They validate the
resolved URL, environment, and per-run consent before a destructive primitive
can execute.

Consumer surface: `prisma/guards/_destructive-guard.ts` —
`assertE2eRuntimeDestructive` and `assertE2eRuntimeDestructiveTarget`.

## Requirements

### Requirement: Block on NODE_ENV=production

The guard MUST refuse when `NODE_ENV === "production"`, regardless of `DATABASE_URL`. No environment variable may bypass this refusal for disposable-database workflows.

Consumer surface: `prisma/guards/_destructive-guard.ts` —
`assertE2eRuntimeDestructiveTarget`.

#### Scenario: Production environment variable is set

- **WHEN** `NODE_ENV` is `"production"` and `DATABASE_URL` points to any database
- **THEN** the disposable-database guard throws before destructive work and MUST NOT advertise a bypass

### Requirement: Block when DATABASE_URL is absent

The guard MUST refuse when `DATABASE_URL` is not set, because a script without an explicit target cannot be verified safe.

#### Scenario: DATABASE_URL is empty or unset

- **WHEN** `DATABASE_URL` is `""` or the environment variable is absent
- **THEN** `assertE2eRuntimeDestructive` throws with a message containing `"DATABASE_URL not set"`

### Requirement: Disposable targets use one exact allowlist and per-run consent

Destructive development and integration workflows MUST accept only loopback PostgreSQL URLs whose raw database path is exactly `customreport_e2e` or `customreport_e2e_lane_[a-o]_test`, with no query, fragment, encoded alias, or credential disclosure. Each destructive invocation MUST also receive the exact per-run consent value required by repository policy.

Consumer surface: `prisma/guards/_destructive-guard.ts` —
`assertE2eRuntimeDestructive` and `assertE2eRuntimeDestructiveTarget`.

#### Scenario: Exact lane target and consent are present

- **WHEN** a loopback URL names `customreport_e2e_lane_a_test` exactly, `NODE_ENV` is not production, and the exact per-run consent is present
- **THEN** the common guard may allow the requested disposable operation

#### Scenario: Broad suffix target is supplied

- **WHEN** a URL names `customreport_test`, `customreport_uat`, `customreport_dev`, or any other non-allowlisted target
- **THEN** the common guard refuses even if the host is local

#### Scenario: URL spelling obscures the target

- **WHEN** the URL contains a query, fragment, encoded path alias, remote host, or missing exact consent
- **THEN** the common guard refuses before destructive work without logging credentials

### Requirement: Integration cleanup requires the shared database target

Under the MVP single-database policy the API integration helper MUST require
both the disposable `E2E_DATABASE_URL` and the developer's actual
`DATABASE_URL`, and both URLs MUST identify the same loopback PostgreSQL
database, parsed host, and port. The host comparison MUST be exact after URL
parsing; loopback aliases are different targets. Credentials and the
`postgres`/`postgresql` scheme do not distinguish otherwise matching targets.
It MUST refuse a missing developer target or URLs that resolve to different
database names, hosts, or ports before allocating a connection pool, discovering
tables, or truncating data. The existing exact target allowlist and per-run
consent remain required. Unit, integration, and coverage entrypoints using the
helper MUST follow the same check.

#### Scenario: Integration runner omits the developer target

- **WHEN** the runner supplies a valid disposable target and consent but omits `DATABASE_URL` or leaves it empty
- **THEN** cleanup refuses before connecting to the database or discovering tables

#### Scenario: Both URLs identify the same database

- **WHEN** both URLs have the same parsed loopback host, database, and port, even with different credentials or PostgreSQL URL schemes
- **THEN** the helper may connect to the shared target for guarded cleanup

#### Scenario: Loopback aliases differ

- **WHEN** the URLs use different parsed loopback hosts such as `localhost` and `127.0.0.1`, or `localhost` and `[::1]`, even with the same database and port
- **THEN** cleanup refuses before allocating a connection pool, discovering tables, or truncating data

#### Scenario: Developer and integration URLs diverge

- **WHEN** the URLs resolve to different database names, hosts, or ports, including distinct loopback literals such as `localhost` and `127.0.0.2`
- **THEN** cleanup refuses before allocating a connection pool

### Requirement: DATABASE_URL and POSTGRES_DB must be consistent

Every dependency manifest and environment example used by a destructive disposable-database workflow MUST use the same accepted database name in both `POSTGRES_DB` and the raw final path segment of `DATABASE_URL`. The guard MUST validate the resolved URL itself; a safe-looking `POSTGRES_DB` value cannot override a different URL target.

Consumer surface: destructive workflow dependency manifests (`deploy/local-dev/deps.yaml`) and environment examples,
plus `prisma/guards/_destructive-guard.ts` —
`assertE2eRuntimeDestructiveTarget`.

#### Scenario: Consistent naming

- **WHEN** `POSTGRES_DB=customreport_e2e` and the raw `DATABASE_URL` path is exactly `/customreport_e2e`
- **THEN** the naming-consistency check passes and the remaining guard checks still apply

#### Scenario: Divergent naming

- **WHEN** `POSTGRES_DB` names an accepted disposable target but `DATABASE_URL` resolves to another database
- **THEN** the guard refuses before destructive work

### Requirement: Restore confirmation identifies the complete resolved target

The production restore entrypoint MUST accept only the current `test` and
`production` environment identities, canonicalize and display the identity,
host, port, and database, and require an exact confirmation token for that
complete target before invoking any destructive `pg_restore` action.

#### Scenario: An undeployed environment label is supplied

- **WHEN** `RESTORE_ENVIRONMENT` is `development`, `uat`, `staging`, or any other undeployed label
- **THEN** restore refuses before archive validation or `pg_restore`

#### Scenario: Database name matches but host differs

- **WHEN** the operator confirms the expected database name while `PGHOST` or `PGPORT` resolves to another cluster
- **THEN** restore refuses before invoking `pg_restore`

#### Scenario: Complete non-production target matches

- **WHEN** the readable archive is valid and the exact non-production environment, host, port, and database token matches
- **THEN** restore may run once in a single transaction

#### Scenario: Production target lacks destructive consent

- **WHEN** the exact production target token matches but the production-destructive consent is absent or malformed
- **THEN** restore refuses before invoking `pg_restore`

#### Scenario: Production target has complete consent

- **WHEN** archive validation, exact target confirmation, and production-destructive consent all match the same resolved target
- **THEN** restore may invoke the single-transaction command and logs the canonical target without credentials
