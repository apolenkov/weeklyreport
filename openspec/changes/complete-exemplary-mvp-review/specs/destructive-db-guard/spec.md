# destructive-db-guard (delta, single-database alignment)

## Purpose

Reconcile the integration helper target check with the owner-approved
single-database policy of 2026-09-18: local dev, tests, and E2E runs share the
one `customreport_e2e` database, so the helper verifies the shared target
explicitly instead of excluding the developer database.

## REMOVED Requirements

### Requirement: Integration cleanup excludes the developer database

**Reason**: The owner single-database decision of 2026-09-18 assigns local
dev, test, and E2E phases to the one `customreport_e2e` database, so requiring
a distinct integration target contradicts the approved runtime topology.
**Migration**: Point `E2E_DATABASE_URL` and `DATABASE_URL` at the same
explicit loopback database and port; the helper verifies the match before
allocating a connection pool or running cleanup SQL.

## ADDED Requirements

### Requirement: Integration cleanup requires the shared database target

Under the MVP single-database policy the API integration helper MUST require
both the disposable `E2E_DATABASE_URL` and the developer's actual
`DATABASE_URL`, and both URLs MUST resolve to the same loopback PostgreSQL
database and port. It MUST refuse a missing developer target or URLs that
resolve to different database names or ports before allocating a connection
pool, discovering tables, or truncating data. The existing exact target
allowlist and per-run consent remain required. Unit, integration, and coverage
entrypoints using the helper MUST follow the same check.

#### Scenario: Integration runner omits the developer target

- **WHEN** the runner supplies a valid disposable target and consent but omits `DATABASE_URL` or leaves it empty
- **THEN** cleanup refuses before connecting to the database or discovering tables

#### Scenario: Both URLs identify the same database

- **WHEN** both URLs resolve to the same loopback PostgreSQL database and port, even with different credentials or loopback aliases
- **THEN** the helper may connect to the shared target for guarded cleanup

#### Scenario: Developer and integration URLs diverge

- **WHEN** the URLs resolve to different database names or ports
- **THEN** cleanup refuses before allocating a connection pool
