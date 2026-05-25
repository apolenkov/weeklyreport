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

### Requirement: DATABASE_URL and POSTGRES_DB must be consistent

Every compose file and env example MUST use the same database name in both `POSTGRES_DB` and the final path segment of `DATABASE_URL`. Divergence means the guard parses a different name than Postgres actually uses.

#### Scenario: Consistent naming

- **WHEN** `POSTGRES_DB=customreport_uat` and `DATABASE_URL` ends in `/customreport_uat`
- **THEN** the guard sees the correct suffixed name and allows the op

#### Scenario: Divergent naming

- **WHEN** `POSTGRES_DB=customreport_uat` but `DATABASE_URL` ends in `/customreport`
- **THEN** the guard refuses even though `POSTGRES_DB` has a safe suffix — it only reads `DATABASE_URL`
