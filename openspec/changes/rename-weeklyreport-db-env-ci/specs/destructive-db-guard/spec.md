# Spec Delta

## MODIFIED Requirements

### Requirement: Disposable targets use one exact allowlist and per-run consent

Destructive development and integration workflows MUST accept only loopback PostgreSQL URLs whose raw database path is exactly `weeklyreport_e2e` or `weeklyreport_e2e_lane_[a-o]_test`, with no query, fragment, encoded alias, or credential disclosure. Each destructive invocation MUST also receive the exact per-run consent value required by repository policy.

Consumer surface: `prisma/guards/_destructive-guard.ts` —
`assertE2eRuntimeDestructive` and `assertE2eRuntimeDestructiveTarget`.

#### Scenario: Exact lane target and consent are present

- **WHEN** a loopback URL names `weeklyreport_e2e_lane_a_test` exactly, `NODE_ENV` is not production, and the exact per-run consent is present
- **THEN** the common guard may allow the requested disposable operation

#### Scenario: Broad suffix target is supplied

- **WHEN** a URL names `weeklyreport_test`, `weeklyreport_uat`, `weeklyreport_dev`, or any other non-allowlisted target
- **THEN** the common guard refuses even if the host is local

#### Scenario: URL spelling obscures the target

- **WHEN** the URL contains a query, fragment, encoded path alias, remote host, or missing exact consent
- **THEN** the common guard refuses before destructive work without logging credentials

### Requirement: DATABASE_URL and POSTGRES_DB must be consistent

Every dependency manifest and environment example used by a destructive disposable-database workflow MUST use the same accepted database name in both `POSTGRES_DB` and the raw final path segment of `DATABASE_URL`. The guard MUST validate the resolved URL itself; a safe-looking `POSTGRES_DB` value cannot override a different URL target.

Consumer surface: destructive workflow dependency manifests (`deploy/local-dev/deps.yaml`) and environment examples,
plus `prisma/guards/_destructive-guard.ts` —
`assertE2eRuntimeDestructiveTarget`.

#### Scenario: Consistent naming

- **WHEN** `POSTGRES_DB=weeklyreport_e2e` and the raw `DATABASE_URL` path is exactly `/weeklyreport_e2e`
- **THEN** the naming-consistency check passes and the remaining guard checks still apply

#### Scenario: Divergent naming

- **WHEN** `POSTGRES_DB` names an accepted disposable target but `DATABASE_URL` resolves to another database
- **THEN** the guard refuses before destructive work
