## Purpose

`prisma/guards/_destructive-guard.ts` exports `assertNonProdDestructive(scriptName)`, called
at the top of every destructive Prisma script (seed, wipe, reset). It inspects the
runtime environment and MUST throw before executing any destructive SQL if the target
looks like production. The guard reads `DATABASE_URL`; env examples and Compose files
MUST keep `POSTGRES_DB` and `DATABASE_URL` in sync so the guard sees the correct
database name.

Consumer surface: `prisma/guards/_destructive-guard.ts` — `assertNonProdDestructive`.

## Requirements

### Requirement: Block on NODE_ENV=production

The guard MUST refuse when `NODE_ENV === "production"`, regardless of `DATABASE_URL`. No environment variable may bypass this refusal for disposable-database workflows.

Consumer surface: `prisma/guards/_destructive-guard.ts` — `assertNonProdDestructive`.

#### Scenario: Production environment variable is set

- **WHEN** `NODE_ENV` is `"production"` and `DATABASE_URL` points to any database
- **THEN** the disposable-database guard throws before destructive work and MUST NOT advertise a bypass

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

### Requirement: Disposable targets use one exact allowlist and per-run consent

Destructive development and integration workflows MUST accept only loopback PostgreSQL URLs whose raw database path is exactly `customreport_e2e` or `customreport_e2e_lane_[a-o]_test`, with no query, fragment, encoded alias, or credential disclosure. Each destructive invocation MUST also receive the exact per-run consent value required by repository policy.

Consumer surface: `prisma/guards/_destructive-guard.ts` — `assertNonProdDestructive` and the shared disposable-target validation used by destructive workflows.

#### Scenario: Exact lane target and consent are present

- **WHEN** a loopback URL names `customreport_e2e_lane_a_test` exactly, `NODE_ENV` is not production, and the exact per-run consent is present
- **THEN** the common guard may allow the requested disposable operation

#### Scenario: Broad suffix target is supplied

- **WHEN** a URL names `customreport_test`, `customreport_uat`, `customreport_dev`, or any other non-allowlisted target
- **THEN** the common guard refuses even if the host is local

#### Scenario: URL spelling obscures the target

- **WHEN** the URL contains a query, fragment, encoded path alias, remote host, or missing exact consent
- **THEN** the common guard refuses before destructive work without logging credentials

### Requirement: DATABASE_URL and POSTGRES_DB must be consistent

Every Compose file and environment example used by a destructive disposable-database workflow MUST use the same accepted database name in both `POSTGRES_DB` and the raw final path segment of `DATABASE_URL`. The guard MUST validate the resolved URL itself; a safe-looking `POSTGRES_DB` value cannot override a different URL target.

Consumer surface: destructive workflow Compose files and environment examples, plus `prisma/guards/_destructive-guard.ts` — `assertNonProdDestructive`.

#### Scenario: Consistent naming

- **WHEN** `POSTGRES_DB=customreport_e2e` and the raw `DATABASE_URL` path is exactly `/customreport_e2e`
- **THEN** the naming-consistency check passes and the remaining guard checks still apply

#### Scenario: Divergent naming

- **WHEN** `POSTGRES_DB` names an accepted disposable target but `DATABASE_URL` resolves to another database
- **THEN** the guard refuses before destructive work

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
