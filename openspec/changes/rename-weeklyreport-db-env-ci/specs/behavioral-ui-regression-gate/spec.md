# Spec Delta

## MODIFIED Requirements

### Requirement: Browser regression destructive setup fails closed on the exact authorized target

The Lead browser regression setup MUST accept only an explicit loopback
PostgreSQL target named exactly `weeklyreport_e2e`, accepted by the repository
destructive guard with `NODE_ENV` non-production and
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`. It MUST display the target
without credentials and perform a guarded reset followed by an explicit seed
before browser execution. All regression Redis clients and any cleanup MUST
use logical DB 15; cleanup MUST pass the same PostgreSQL guard and consent.
Target mismatch, missing consent or another Redis DB MUST fail before a
destructive operation. Browser execution MUST require the coordinator's
explicit handoff of the shared target and MUST NOT start, stop or restart its
web/API processes. Before the first scenario, global setup MUST observe the
running app through the web origin, a dev-mode API query that reports the
database of its live connection and its configured Redis DB, and MUST fail
unless they are exactly `weeklyreport_e2e` and `15`; `/health/ready` alone
is not sufficient evidence. The web origin defaults to `http://localhost:3000` and MAY be overridden by
`E2E_BASE_URL` (a bare http(s) origin; anything else MUST fail closed); the
database and Redis checks above apply unchanged. The loopback and Redis DB 15 checks MUST live in
one shared guard module reused by setup and the guarded Redis cleanup. After the authorized live task, the canonical full dataset
MUST be restored through the guarded reset/seed workflow from the application
checkout, with exit code 0 recorded before target handoff.

#### Scenario: Setup receives a runtime lane or another database

- **WHEN** setup receives any database name other than `weeklyreport_e2e`
- **THEN** it refuses before connecting or resetting
- **AND** no PostgreSQL or Redis state is changed

#### Scenario: Redis DB or per-command consent is absent

- **WHEN** `REDIS_DB` is not exactly `15` or the exact consent is missing
- **THEN** setup fails before reset, seed or Redis cleanup

#### Scenario: The running app uses another database or Redis DB

- **WHEN** the app behind the web origin reports a database other than `weeklyreport_e2e`, a Redis DB other than `15`, or no runtime-target answer
- **THEN** global setup fails with an explicit error before any scenario or reset runs

#### Scenario: The authorized live task returns the shared target

- **WHEN** browser correction and acceptance finish against the handed-over target
- **THEN** the canonical full reset and seed complete through the repository guard with exit 0
- **AND** the report records restoration without stopping or restarting the existing web/API

### Requirement: Guarded Redis cleanup flushes only the Redis DB assigned to its database

The guarded Redis cleanup (`reset-hard`) MUST derive the logical Redis DB from
the guard-approved `DATABASE_URL` database: `weeklyreport_e2e` maps to DB 15 and
`weeklyreport_e2e_lane_a_test` through `..._lane_l_test` map to DB 1 through 12.
It MUST fail before opening a Redis connection unless `REDIS_DB` equals that
exact DB. DB 0, 13 and 14, a DB assigned to another database, and lanes without
an assigned DB (`m` to `o`) MUST NOT be flushed.

#### Scenario: A lane run selects another Redis DB

- **WHEN** the target database is `weeklyreport_e2e_lane_b_test` and `REDIS_DB` is `15`, `0` or `1`
- **THEN** cleanup fails before connecting and no Redis state changes

#### Scenario: A lane run uses its own Redis DB

- **WHEN** the target database is `weeklyreport_e2e_lane_b_test` and `REDIS_DB` is `2`
- **THEN** cleanup selects DB 2 and only then flushes it
