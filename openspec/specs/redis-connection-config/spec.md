# redis-connection-config Specification

## Purpose

Derive every Redis connection from one fail-loud validated configuration
builder, including the explicitly selected logical database, and keep
Redis-backed service instances under dependency injection.

## Requirements

### Requirement: Redis database, host, and port MUST come from one validated-env builder

The API MUST derive the Redis connection `db`, `host`, and `port` from a single
`buildRedisConnectionOptions(env)` helper that reads only the validated
`EnvConfig` (`REDIS_DB`, `REDIS_HOST`, `REDIS_PORT`). `REDIS_DB` selects the
logical database for the client; product/dev uses logical DB `0`, while the
guarded E2E lane uses logical DB `15`. The helper MUST NOT read
`process.env` directly, MUST NOT coerce the port with `Number(...)` (the
validated `EnvConfig.REDIS_PORT` is already a `number`), and MUST NOT supply any
fallback or default value for any field. It returns exactly `{ db, host, port }`;
per-client resilience flags are the caller's concern.

#### Scenario: The helper returns the validated database, host, and port

- **WHEN** `buildRedisConnectionOptions(env)` is called with a validated
  `EnvConfig` whose `REDIS_DB` is `0`, `REDIS_HOST` is `"redis"`, and
  `REDIS_PORT` is `6379`
- **THEN** it returns `{ db: 0, host: "redis", port: 6379 }`
- **AND** it reads neither `process.env.REDIS_HOST` nor `process.env.REDIS_PORT`

#### Scenario: The helper carries no fallback for a missing value

- **WHEN** a reviewer inspects `buildRedisConnectionOptions`
- **THEN** it contains no `?? "localhost"`, no `?? 6379`, and no `.default(...)`
- **AND** absence of `REDIS_DB`/`REDIS_HOST`/`REDIS_PORT` is already rejected upstream by
  the env schema, so the helper never observes an unset value

### Requirement: Every Redis consumer MUST obtain database, host, and port from the builder

Each API consumer that constructs an ioredis client or a BullMQ connection MUST
obtain its `db`, `host`, and `port` by spreading `buildRedisConnectionOptions(env)`,
and MUST NOT inline `requireEnv(process.env, "REDIS_HOST")` or
`Number(requireEnv(process.env, "REDIS_PORT"))`. The consumers are
`bullmq-options.ts` (`getBullMQConnectionOptions`), `redis.health.ts`,
`admin.module.ts` (the session-revocation Redis provider), `analytics.cache.ts`, `telemetry.cache.ts`,
and `rate-limit.middleware.ts` (the `rate-limit-redis` store's ioredis
client). A consumer MAY add its own resilience flags (`lazyConnect`,
`maxRetriesPerRequest`, `enableOfflineQueue`) alongside the spread, because
those differ per consumer and are not env-derived.

#### Scenario: A consumer builds its connection from the helper

- **WHEN** `getBullMQConnectionOptions` constructs its connection options
- **THEN** its `db`/`host`/`port` come from `buildRedisConnectionOptions(env)`
- **AND** its own `maxRetriesPerRequest: null` is preserved alongside the spread

#### Scenario: No consumer re-reads process.env for host or port

- **WHEN** the six named consumers are searched for Redis connection reads
- **THEN** none contains `requireEnv(process.env, "REDIS_HOST")` or
  `Number(requireEnv(process.env, "REDIS_PORT"))`
- **AND** each consumer retains its declared resilience flags alongside the
  shared host and port

#### Scenario: The rate-limit Redis store builds its client from the helper

- **WHEN** `rate-limit.middleware.ts` constructs the ioredis client backing
  its `RedisStore`
- **THEN** its `host`/`port` come from `buildRedisConnectionOptions(env)`
- **AND** it reads neither `process.env.REDIS_HOST` nor
  `process.env.REDIS_PORT` directly

### Requirement: A missing Redis connection field MUST fail boot loud

The env schema MUST keep `REDIS_DB`, `REDIS_HOST`, and `REDIS_PORT` REQUIRED with no
`.default()`, so a deploy that omits either fails validation at boot rather than
silently connecting to a wrong host or port. This preserves the no-silent-default
contract after the connection read is centralized: the single builder reads
only already-validated values, so there is
exactly one place the fields are consumed and no place a fallback can reappear.

#### Scenario: Boot fails when REDIS_HOST is unset

- **WHEN** `validateEnv()` runs with `REDIS_HOST` unset
- **THEN** validation fails and `validateEnv()` calls `process.exit(1)` rather
  than returning a config
- **AND** no consumer ever reaches `buildRedisConnectionOptions` with a missing
  host

#### Scenario: Boot rejects an invalid logical database

- **WHEN** `validateEnv()` runs with `REDIS_DB` set outside the supported logical
  database range
- **THEN** validation fails on `REDIS_DB` before any Redis connection is
  constructed

#### Scenario: Boot fails when REDIS_PORT is not a positive integer

- **WHEN** `validateEnv()` runs with `REDIS_PORT` set to `"not-a-number"`
- **THEN** validation fails on path `REDIS_PORT` (via `z.coerce.number().int().positive()`)
- **AND** boot aborts before any Redis connection is constructed

### Requirement: The readiness Redis client MUST fail fast

The `RedisHealthIndicator` ioredis client MUST set `maxRetriesPerRequest: 1`
and a bounded `commandTimeout` (2s), and MUST install a no-op `error` listener,
(the offline queue stays ENABLED: with `lazyConnect`, disabling it rejects the
first ping while the client is still connecting — a deterministic false "down"
at process start against a healthy Redis),
matching the `read-through-cache.ts` and session-revocation (`admin.module.ts`)
clients. This bounds how long a `ping()` issued during a Redis outage can
stay queued before rejecting, and prevents ioredis's unhandled `error`
events from being dumped to raw stderr.

#### Scenario: Ping rejects promptly during a Redis outage

- **WHEN** Redis is unreachable and `RedisHealthIndicator.isHealthy("redis")`
  calls `this.redis.ping()`
- **THEN** the ping rejects after at most one retry attempt, not after
  ioredis's default ~20 reconnect attempts
- **AND** `isHealthy` still returns a `down` `HealthIndicatorResult` from its
  existing catch block

#### Scenario: A Redis outage produces no unhandled error dump

- **WHEN** the ioredis client underlying `RedisHealthIndicator` emits an
  `error` event during a reconnect attempt
- **THEN** the no-op `error` listener consumes it
- **AND** no raw ioredis error is written to stderr outside the health
  indicator's own `down()` result

### Requirement: Every Redis-backed service instance MUST be DI-managed, not constructed with `new`

Any code path that needs a `SessionRevocationService` (or another Redis-backed, DI-registered service) MUST resolve it via `app.get(...)` from the Nest DI container, and MUST NOT construct a fresh instance with `new`, because a `new` instance owns its own unmanaged ioredis client that is never closed by application shutdown hooks.

#### Scenario: The PDF download handler reuses the DI-managed singleton

- **GIVEN** the PDF download route handler needs `SessionRevocationService`
- **WHEN** the handler is wired in `main.ts`
- **THEN** it resolves the instance via `app.get(SessionRevocationService)`
- **AND** no `new SessionRevocationService(...)` call exists in `main.ts`

#### Scenario: The tRPC context factory reuses the DI-managed singleton

- **GIVEN** the tRPC context factory needs `SessionRevocationService`
- **WHEN** `createContextFactory` builds a request context
- **THEN** it resolves the instance via `app.get(SessionRevocationService)`
- **AND** no `new SessionRevocationService(...)` call exists in `trpc.context.ts`
