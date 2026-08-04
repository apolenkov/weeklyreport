## Purpose

`prisma/_destructive-guard.ts` exports `assertNonProdDestructive(scriptName)`, called
at the top of every destructive Prisma script (seed, wipe, reset). It inspects the
runtime environment and MUST throw before executing any destructive SQL if the target
looks like production. The guard reads `DATABASE_URL`; env examples and Compose files
MUST keep `POSTGRES_DB` and `DATABASE_URL` in sync so the guard sees the correct
database name.

Consumer surface: `prisma/_destructive-guard.ts` — `assertNonProdDestructive`.

## Requirements

### Requirement: Block on NODE_ENV=production

The guard MUST refuse when `NODE_ENV === "production"`, regardless of `DATABASE_URL`.

#### Scenario: Production environment variable is set

- **WHEN** `NODE_ENV` is `"production"` and `DATABASE_URL` points to a non-prod database
- **THEN** `assertNonProdDestructive` throws with a message containing `"NODE_ENV=production"` and a hint about `ALLOW_PROD_DESTRUCTIVE=yes`

### Requirement: Block when DATABASE_URL is absent

The guard MUST refuse when `DATABASE_URL` is not set, because a script without an explicit target cannot be verified safe.

#### Scenario: DATABASE_URL is empty or unset

- **WHEN** `DATABASE_URL` is `""` or the environment variable is absent
- **THEN** `assertNonProdDestructive` throws with a message containing `"DATABASE_URL not set"`

### Requirement: Block on prod-smelling database name

The guard MUST refuse when the database name (last path segment of `DATABASE_URL`, before `?`) matches `prod`, `production`, or `live` as a whole-word match — regardless of host. This catches tunnelled or SSH-forwarded production connections.

#### Scenario: Database name contains prod

- **WHEN** `DATABASE_URL` ends in `/myapp_prod` or `/production` or `/live_db`
- **THEN** `assertNonProdDestructive` throws with a message containing the database name and `"looks like production"`

#### Scenario: Database name contains prod as substring of another word

- **WHEN** `DATABASE_URL` ends in `/report_products` (substring, not a whole word)
- **THEN** `assertNonProdDestructive` does NOT throw based on name alone

### Requirement: Allow truly local hosts unconditionally

Hosts `localhost` and `127.0.0.1` are physically unreachable from production. Hosts ending in `.local` are also treated as safe. The guard MUST allow these hosts regardless of database name suffix.

#### Scenario: localhost with no suffix

- **WHEN** `DATABASE_URL` is `postgresql://user:pass@localhost:5432/myapp`
- **THEN** `assertNonProdDestructive` does not throw

#### Scenario: 127.0.0.1 with no suffix

- **WHEN** `DATABASE_URL` is `postgresql://user:pass@127.0.0.1:5432/myapp`
- **THEN** `assertNonProdDestructive` does not throw

### Requirement: Require explicit non-prod suffix for non-local hosts

For hosts that are not `localhost`, `127.0.0.1`, or `*.local` — including the Docker Compose service name `postgres` — the database name MUST carry one of the suffixes `_uat`, `_dev`, `_test`, `_local`, or `_staging`. The Docker Compose service name `postgres` is intentionally excluded from the truly-local allowlist.

#### Scenario: Docker service name without suffix

- **WHEN** `DATABASE_URL` is `postgresql://user:pass@postgres:5432/customreport`
- **THEN** `assertNonProdDestructive` throws, citing host `"postgres"` and missing suffix

#### Scenario: Docker service name with valid suffix

- **WHEN** `DATABASE_URL` is `postgresql://user:pass@postgres:5432/customreport_uat`
- **THEN** `assertNonProdDestructive` does not throw

#### Scenario: Remote host without suffix

- **WHEN** `DATABASE_URL` is `postgresql://user:pass@db.example.com:5432/customreport`
- **THEN** `assertNonProdDestructive` throws

#### Scenario: Remote host with valid suffix

- **WHEN** `DATABASE_URL` is `postgresql://user:pass@db.example.com:5432/customreport_dev`
- **THEN** `assertNonProdDestructive` does not throw

### Requirement: ALLOW_PROD_DESTRUCTIVE escape hatch

When `ALLOW_PROD_DESTRUCTIVE === "yes"`, the guard MUST skip all checks and allow the operation. This is the explicit override for production data migration scenarios.

#### Scenario: Override env var set

- **WHEN** `ALLOW_PROD_DESTRUCTIVE` is `"yes"` and `NODE_ENV` is `"production"`
- **THEN** `assertNonProdDestructive` does not throw

### Requirement: Integration-test cleanup asserts a \_test database name

The integration-test cleanup helper MUST assert that the database name
in `DATABASE_URL` (last path segment, before `?`) ends with `_test`
before executing any destructive SQL, regardless of host. The helper is
`cleanDatabase` in `apps/api/src/test-utils/prisma-test-helper.ts`.
Localhost is NOT auto-trusted: the helper wipes every application
table, so the weaker `assertNonProdDestructive` localhost allowance
does not apply to it. The check is exposed as `assertTestDatabaseUrl`
in the same module; its error MUST name the offending database name and
MUST NOT echo credentials.

Consumer surface: `apps/api/src/test-utils/prisma-test-helper.ts` —
`cleanDatabase`, `assertTestDatabaseUrl`.

#### Scenario: cleanDatabase against the dedicated test database

- **WHEN** `DATABASE_URL` is
  `postgresql://user:pass@localhost:5432/customreport_test`
- **THEN** `cleanDatabase` proceeds without a guard error

#### Scenario: cleanDatabase against a dev database on localhost

- **WHEN** `DATABASE_URL` is
  `postgresql://user:pass@localhost:5432/customreport_dev`
- **THEN** `cleanDatabase` throws before executing any SQL
- **AND** the error message contains `customreport_dev` and the
  `_test` requirement

#### Scenario: cleanDatabase against an unsuffixed database name

- **WHEN** `DATABASE_URL` ends in `/customreport`
- **THEN** `cleanDatabase` throws before executing any SQL

#### Scenario: remote host with a \_test-suffixed database

- **WHEN** `DATABASE_URL` is
  `postgresql://user:pass@db.example.com:5432/customreport_test`
- **THEN** `assertTestDatabaseUrl` does not throw — the suffix, not the
  host, is the contract

### Requirement: DATABASE_URL and POSTGRES_DB must be consistent

Every compose file and env example MUST use the same database name in both `POSTGRES_DB` and the final path segment of `DATABASE_URL`. Divergence means the guard parses a different name than Postgres actually uses.

#### Scenario: Consistent naming

- **WHEN** `POSTGRES_DB=customreport_uat` and `DATABASE_URL` ends in `/customreport_uat`
- **THEN** the guard sees the correct suffixed name and allows the op

#### Scenario: Divergent naming

- **WHEN** `POSTGRES_DB=customreport_uat` but `DATABASE_URL` ends in `/customreport`
- **THEN** the guard refuses even though `POSTGRES_DB` has a safe suffix — it only reads `DATABASE_URL`

### Requirement: Restore confirmation identifies the complete resolved target

The production restore entrypoint MUST canonicalize and display environment identity, host, port, and database, and MUST require an exact confirmation token for that complete target before invoking any destructive `pg_restore` action.

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
