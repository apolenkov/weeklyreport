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
MUST call `this.logger.error(...)` with a JSON-serialisable payload that
includes at minimum `{ phase: 'pg.pool.error', message: err.message }`.
The listener MUST NOT rethrow or swallow the error silently. An unhandled
`error` event on the pool MUST NOT be allowed to reach the Node.js process
uncaught-exception handler.

#### Scenario: An idle pool client raises a connection error

- **GIVEN** `PrismaService` has initialised and the pool is active
- **WHEN** an idle `pg` client in the pool emits an `error` event
- **THEN** `PrismaService` logs the error at NestJS `Logger` error level
  with `phase: 'pg.pool.error'` and the error message in the payload,
  and the Node.js process remains running

#### Scenario: No pool error occurs during normal operation

- **GIVEN** `PrismaService` has initialised
- **WHEN** the pool is used for normal queries without idle-client errors
- **THEN** the `pool.on('error', ...)` listener does not emit any log entry

### Requirement: Pool size and timeouts are env-configurable with safe defaults

`PrismaService` MUST read three optional env vars at construction time and
pass them to the `pg.Pool` constructor:

- `DB_POOL_MAX` — parsed as integer; MUST default to `10` when absent or
  non-numeric.
- `DB_POOL_IDLE_TIMEOUT_MS` — parsed as integer (milliseconds); MUST
  default to `10000` when absent or non-numeric.
- `DB_POOL_CONNECTION_TIMEOUT_MS` — parsed as integer (milliseconds);
  MUST default to `0` (disabled) when absent or non-numeric.

The resolved values MUST be logged at NestJS `Logger` log level (info)
during `onModuleInit` so operators can confirm the active pool configuration
in structured logs.

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

#### Scenario: Resolved pool config is logged at boot

- **GIVEN** `PrismaService` has been constructed with any pool configuration
- **WHEN** `onModuleInit` completes
- **THEN** a log entry at info level records the resolved `max`,
  `idleTimeoutMillis`, and `connectionTimeoutMillis` values alongside the
  "Database connection established" message
