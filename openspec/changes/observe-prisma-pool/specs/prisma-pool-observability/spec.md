# prisma-pool-observability Specification

## Purpose

Pin the contract that `PrismaService` never silently drops idle pg-pool
errors and that pool size and timeout are operator-configurable via env
vars, so runaway connection exhaustion and idle-client crashes are visible
in structured logs before they become outages.

## ADDED Requirements

### Requirement: Idle pg-pool errors route to structured logs

`PrismaService` MUST register a `pool.on('error', ...)` listener on the
`pg.Pool` instance before the first connection is accepted. The listener
MUST call `this.logger.error(message)` with a single string argument that
embeds `JSON.stringify({ phase: 'pg.pool.error', message: err.message })`,
matching the existing `slow query ${JSON.stringify(...)}` convention already
used in the same file. The structured fields MUST live inside that one
string argument and MUST NOT be passed as an object payload or as a second
metadata argument: the active `NestAppLoggerAdapter` coerces the first
argument with `String(...)` (an object becomes `[object Object]`) and treats
any second argument as the Nest log context, so only the embedded-string form
survives. The listener MUST NOT rethrow or swallow the error silently. An
unhandled `error` event on the pool MUST NOT be allowed to reach the Node.js
process uncaught-exception handler.

#### Scenario: An idle pool client raises a connection error

- **GIVEN** `PrismaService` has initialised and the pool is active
- **WHEN** an idle `pg` client in the pool emits an `error` event
- **THEN** `PrismaService` logs the error at NestJS `Logger` error level
  with a single message string embedding `phase: 'pg.pool.error'` and the
  error message, and the Node.js process remains running

#### Scenario: No pool error occurs during normal operation

- **GIVEN** `PrismaService` has initialised
- **WHEN** the pool is used for normal queries without idle-client errors
- **THEN** the `pool.on('error', ...)` listener does not emit any log entry

### Requirement: Pool size and timeouts are env-configurable with safe defaults

`PrismaService` MUST read three optional env vars at construction time,
range-validate each, and pass only the resolved values to the `pg.Pool`
constructor. An env value that is absent, non-numeric, or numeric but outside
its valid range MUST fall back to the documented default and MUST NOT be
passed through to `pg`:

- `DB_POOL_MAX` — parsed as integer; valid range is a positive integer
  (`>= 1`); MUST default to `10` when absent, non-numeric, zero, or negative.
  A `0` or negative `max` is unsafe: `pg` coerces `0` to `10` (so a logged
  `0` would lie about the active size) and keeps a negative `max`, which
  makes the pool report permanently full and — with the default
  `connectionTimeoutMillis: 0` — hang every queued query forever.
- `DB_POOL_IDLE_TIMEOUT_MS` — parsed as integer (milliseconds); valid range
  is a non-negative integer (`>= 0`); MUST default to `10000` when absent,
  non-numeric, or negative.
- `DB_POOL_CONNECTION_TIMEOUT_MS` — parsed as integer (milliseconds); valid
  range is a non-negative integer (`>= 0`); MUST default to `0` (disabled)
  when absent, non-numeric, or negative.

No arbitrary upper cap is imposed on `DB_POOL_MAX`; the `.env.example`
advisory to keep it below the DB server's `max_connections` covers the high
side. The resolved values MUST be logged at NestJS `Logger` log level (info)
during `onModuleInit`, and the logged values MUST equal the values actually
passed to the `pg.Pool` constructor, so operators can confirm the active
pool configuration in structured logs.

#### Scenario: Env vars are set to custom values

- **GIVEN** `DB_POOL_MAX=20`, `DB_POOL_IDLE_TIMEOUT_MS=30000`, and
  `DB_POOL_CONNECTION_TIMEOUT_MS=5000` are present in the environment
- **WHEN** `PrismaService` is constructed
- **THEN** the `pg.Pool` is created with `max: 20`,
  `idleTimeoutMillis: 30000`, and `connectionTimeoutMillis: 5000`

#### Scenario: Env vars are absent

- **GIVEN** none of `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, or
  `DB_POOL_CONNECTION_TIMEOUT_MS` are set
- **WHEN** `PrismaService` is constructed
- **THEN** the `pg.Pool` is created with `max: 10`,
  `idleTimeoutMillis: 10000`, and `connectionTimeoutMillis: 0`

#### Scenario: Env vars are numeric but out of range

- **GIVEN** `DB_POOL_MAX=-1` is set, along with `DB_POOL_CONNECTION_TIMEOUT_MS=-5`
- **WHEN** `PrismaService` is constructed
- **THEN** the `pg.Pool` is created with `max: 10` and
  `connectionTimeoutMillis: 0` — each invalid value replaced by its default —
  and the value logged at boot equals the value passed to `pg.Pool`

#### Scenario: DB_POOL_MAX is zero

- **GIVEN** `DB_POOL_MAX=0` is set
- **WHEN** `PrismaService` is constructed
- **THEN** the `pg.Pool` is created with `max: 10` (not `0`), and the boot
  log records `10`, never the rejected `0` that `pg` would have coerced

#### Scenario: Resolved pool config is logged at boot

- **GIVEN** `PrismaService` has been constructed with any pool configuration
- **WHEN** `onModuleInit` completes
- **THEN** a log entry at info level records the resolved `max`,
  `idleTimeoutMillis`, and `connectionTimeoutMillis` values alongside the
  "Database connection established" message, and each logged value equals the
  value actually passed to the `pg.Pool` constructor
