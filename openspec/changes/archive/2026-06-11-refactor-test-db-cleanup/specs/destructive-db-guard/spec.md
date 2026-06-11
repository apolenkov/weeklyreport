## ADDED Requirements

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
