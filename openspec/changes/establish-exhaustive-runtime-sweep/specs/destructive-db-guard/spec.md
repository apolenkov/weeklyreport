## MODIFIED Requirements

### Requirement: Block on NODE_ENV=production

The exact E2E/runtime destructive guard MUST refuse when `NODE_ENV` is
`production`, regardless of the database URL or any override variable. Every
destructive Prisma operation, PostgreSQL connection, database creation,
cleanup, Redis flush, or child process in the E2E/runtime entrypoint set MUST
call the same guard before the first corresponding primitive.

#### Scenario: Production runtime is always blocked

- **WHEN** `NODE_ENV` is `production` and an E2E/runtime entrypoint requests a
  destructive operation
- **THEN** the exact guard throws before Prisma, `pg`, Redis, `CREATE DATABASE`,
  reset/seed/cleanup, or child-process execution
- **AND** `ALLOW_PROD_DESTRUCTIVE=yes` does not change the result

#### Scenario: Production environment variable is set

- **WHEN** `NODE_ENV` is `production` and `DATABASE_URL` points to a
  disposable-looking database
- **THEN** the exact guard throws before any destructive primitive
- **AND** the error identifies `NODE_ENV=production`

### Requirement: Block when DATABASE_URL is absent

The exact E2E/runtime guard MUST refuse an absent or empty target before any
destructive primitive. The target MUST be supplied explicitly by the entrypoint
or by `E2E_DATABASE_URL` for runtime helpers.

#### Scenario: Missing target fails before mutation

- **WHEN** a destructive E2E/runtime entrypoint has no target URL
- **THEN** the guard throws with `DATABASE_URL not set` (or the named E2E target
  equivalent)
- **AND** no database, Redis, or child-process primitive is called

#### Scenario: DATABASE_URL is empty or unset

- **WHEN** the target URL is empty or absent
- **THEN** the exact guard throws before any destructive primitive
- **AND** the error identifies the missing database URL

### Requirement: Block on prod-smelling database name

The exact E2E/runtime guard MUST reject every database name outside the exact
allowlist `customreport_e2e` and `customreport_e2e_lane_[a-o]_test`. A name that
looks non-production but is not an exact allowlist member MUST still be
rejected.

#### Scenario: Only exact disposable names pass

- **WHEN** the raw PostgreSQL path names `customreport_e2e` or
  `customreport_e2e_lane_a_test` through `customreport_e2e_lane_o_test`
- **THEN** the name passes the target portion of the guard
- **WHEN** the path names `customreport_dev`, `customreport_test`, a production
  name, a different lane, or an unsuffixed application database
- **THEN** the guard refuses before the operation

#### Scenario: Database name contains prod

- **WHEN** the raw path names a production-looking database such as
  `customreport_prod` or `production`
- **THEN** the exact allowlist rejects it before the operation

#### Scenario: Database name contains prod as substring of another word

- **WHEN** the raw path names `report_products`
- **THEN** the exact allowlist rejects it because it is not an authorized
  disposable target, without relying on substring matching

### Requirement: Integration-test cleanup asserts a _test database name

Integration cleanup and runtime state reset MUST use the central exact guard
with `E2E_DATABASE_URL`, not a `_test` suffix heuristic. The URL MUST be one of
the exact disposable names and every destructive reset/reseed/cleanup MUST
carry `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`.

#### Scenario: Integration cleanup is distinct and consent-bound

- **WHEN** `E2E_DATABASE_URL` is `customreport_e2e` (or an allowed runtime lane),
  differs from `DATABASE_URL`, and exact consent is present
- **THEN** cleanup may invoke its seed/reset command
- **WHEN** the target is the developer database, an encoded alias, or consent
  is missing
- **THEN** cleanup refuses before `pg`, Prisma, or child-process execution

### Requirement: DATABASE_URL and POSTGRES_DB must be consistent

CI services and environment examples MUST keep `POSTGRES_DB` and the final
`DATABASE_URL` path equal. The E2E job MUST use an allowed lane database for
the service/base `DATABASE_URL`, create the distinct `customreport_e2e`
database for E2E setup, and set exact consent explicitly. The migrate-reset
job MAY use `customreport_e2e` on its separate runner.

#### Scenario: CI uses two distinct allowed databases

- **WHEN** the E2E service/base target is
  `customreport_e2e_lane_a_test` and `E2E_DATABASE_URL` is `customreport_e2e`
- **THEN** both names pass exact validation and the two targets remain distinct
- **AND** the migrate-reset runner may use `customreport_e2e` with exact consent

#### Scenario: Consistent naming

- **WHEN** `POSTGRES_DB` and the final `DATABASE_URL` path both name
  `customreport_e2e_lane_a_test`
- **THEN** the CI target is accepted as the exact base database

#### Scenario: Divergent naming

- **WHEN** `POSTGRES_DB` and the final `DATABASE_URL` path name different
  databases
- **THEN** workflow validation rejects the drift before a destructive command

## REMOVED Requirements

### Requirement: Allow truly local hosts unconditionally

The old host-only allowlist is removed; loopback is now necessary but not
sufficient because the database name must also be an exact disposable target.

### Requirement: Require explicit non-prod suffix for non-local hosts

The old suffix heuristic and non-local host exception are removed. E2E/runtime
operations use the exact loopback disposable-target contract below.

### Requirement: ALLOW_PROD_DESTRUCTIVE escape hatch

The TypeScript escape hatch is removed from E2E/runtime authorization. The
production restore shell entrypoint retains its separate contract.

## ADDED Requirements

### Requirement: E2E/runtime targets are exact loopback disposable databases

The E2E/runtime guard MUST accept only `localhost`, `::1`, or an IPv4 loopback
literal in `127.0.0.0/8`, together with the exact raw path
`customreport_e2e` or `customreport_e2e_lane_[a-o]_test`. It MUST reject DNS
aliases, private-network addresses, suffix-only names, encoded or case aliases,
query strings, fragments, extra path segments, and leading/trailing
whitespace.

#### Scenario: Exact loopback target passes without connecting

- **WHEN** the URL uses a supported PostgreSQL protocol, a loopback host, and
  an exact disposable database path
- **THEN** target validation passes without opening a connection

#### Scenario: Unsafe or ambiguous target fails before connection

- **WHEN** the URL uses a non-loopback host, suffix-only name, encoded path,
  case variant, query, fragment, whitespace, or extra path segment
- **THEN** the guard refuses before `pg` or Prisma connection

### Requirement: E2E/runtime destructive operations require exact per-run consent

Every E2E/runtime destructive operation MUST require
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'` in the operation's
explicit environment. Target-only planning and readiness checks MAY use the
same parser without consent when they prove that no mutation primitive is
reachable.

#### Scenario: Missing or malformed consent fails closed

- **WHEN** a destructive operation has absent, whitespace, or non-exact consent
- **THEN** the guard refuses before mutation, connection, cleanup, Redis flush,
  database creation, or child spawn

### Requirement: E2E/runtime operations have no override bypass

`ALLOW_PROD_DESTRUCTIVE` MUST NOT bypass the exact E2E/runtime guard. Production
restore remains a separate entrypoint with its existing complete-target
confirmation and production consent contract.

#### Scenario: Override cannot authorize an E2E/runtime target

- **WHEN** `ALLOW_PROD_DESTRUCTIVE=yes` is present and the E2E/runtime target is
  unsafe or `NODE_ENV=production`
- **THEN** the exact guard still refuses before the destructive primitive

### Requirement: The exact validator is the one destructive boundary

The repository MUST expose one exact target validator for E2E/runtime
operations. Central E2E setup, direct seed/profile entrypoints, integration
cleanup, runtime-lane CLI/public/preflight/state/control-recovery paths, reset-
hard, wipe-manual-uat, and policy backfill MUST call it before their relevant
destructive primitive. No broad TypeScript suffix/override guard may remain as
an alternate authorization path.

#### Scenario: Negative entrypoint tests prove fail-before-primitive

- **WHEN** a caller supplies an unsafe target, an encoded alias, production
  runtime, or missing exact consent
- **THEN** the caller fails before mutation, connection, database creation,
  Redis flush, or child spawn
- **AND** the test observes that the primitive was not invoked

#### Scenario: Target-only planning remains non-mutating

- **WHEN** a guard-only runtime lane target-plan command validates an allowed
  target
- **THEN** it may use the same parser without consent or a mutation
- **AND** it emits target evidence with `destructiveOperationsAllowed=false`
