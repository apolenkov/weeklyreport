## MODIFIED Requirements

### Requirement: Block on NODE_ENV=production

The guard MUST refuse when `NODE_ENV === "production"`, regardless of `DATABASE_URL`. No environment variable may bypass this refusal for disposable-database workflows.

Consumer surface: `prisma/guards/_destructive-guard.ts` — `assertNonProdDestructive`.

#### Scenario: Production environment variable is set

- **WHEN** `NODE_ENV` is `"production"` and `DATABASE_URL` points to any database
- **THEN** the disposable-database guard throws before destructive work and MUST NOT advertise a bypass

### Requirement: DATABASE_URL and POSTGRES_DB must be consistent

Every Compose file and environment example used by a destructive disposable-database workflow MUST use the same accepted database name in both `POSTGRES_DB` and the raw final path segment of `DATABASE_URL`. The guard MUST validate the resolved URL itself; a safe-looking `POSTGRES_DB` value cannot override a different URL target.

Consumer surface: destructive workflow Compose files and environment examples, plus `prisma/guards/_destructive-guard.ts` — `assertNonProdDestructive`.

#### Scenario: Consistent naming

- **WHEN** `POSTGRES_DB=customreport_e2e` and the raw `DATABASE_URL` path is exactly `/customreport_e2e`
- **THEN** the naming-consistency check passes and the remaining guard checks still apply

#### Scenario: Divergent naming

- **WHEN** `POSTGRES_DB` names an accepted disposable target but `DATABASE_URL` resolves to another database
- **THEN** the guard refuses before destructive work

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Allow truly local hosts unconditionally

**Reason**: A loopback host does not prove that the database itself is disposable.

**Migration**: Use one exact accepted disposable database name and the common per-run consent guard.

### Requirement: Require explicit non-prod suffix for non-local hosts

**Reason**: Broad suffixes and remote hosts are outside the repository's disposable-target contract.

**Migration**: Run disposable workflows only against the exact loopback targets listed above.

### Requirement: ALLOW_PROD_DESTRUCTIVE escape hatch

**Reason**: Disposable workflows have no production bypass; production restore uses a separate entrypoint and confirmation contract.

**Migration**: Use the guarded production restore workflow for an explicitly authorized restore operation.

### Requirement: Integration-test cleanup asserts a \_test database name

**Reason**: A generic `_test` suffix admits unapproved databases and duplicates the common guard.

**Migration**: Route integration cleanup through the exact shared disposable-target validator and per-run consent.
