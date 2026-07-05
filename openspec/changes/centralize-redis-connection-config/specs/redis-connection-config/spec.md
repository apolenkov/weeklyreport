## ADDED Requirements

### Requirement: Redis host and port MUST come from one validated-env builder

The API MUST derive the Redis connection `host` and `port` from a single
`buildRedisConnectionOptions(env)` helper that reads only the validated
`EnvConfig` (`REDIS_HOST`, `REDIS_PORT`). The helper MUST NOT read
`process.env` directly, MUST NOT coerce the port with `Number(...)` (the
validated `EnvConfig.REDIS_PORT` is already a `number`), and MUST NOT supply any
fallback or default value for either field. It returns exactly `{ host, port }`;
per-client resilience flags are the caller's concern.

#### Scenario: The helper returns the validated host and port

- **WHEN** `buildRedisConnectionOptions(env)` is called with a validated
  `EnvConfig` whose `REDIS_HOST` is `"redis"` and `REDIS_PORT` is `6379`
- **THEN** it returns `{ host: "redis", port: 6379 }`
- **AND** it reads neither `process.env.REDIS_HOST` nor `process.env.REDIS_PORT`

#### Scenario: The helper carries no fallback for a missing value

- **WHEN** a reviewer inspects `buildRedisConnectionOptions`
- **THEN** it contains no `?? "localhost"`, no `?? 6379`, and no `.default(...)`
- **AND** absence of `REDIS_HOST`/`REDIS_PORT` is already rejected upstream by
  the env schema, so the helper never observes an unset value

### Requirement: Every Redis consumer MUST obtain host/port from the builder

Each API consumer that constructs an ioredis client or a BullMQ connection MUST
obtain its `host` and `port` by spreading `buildRedisConnectionOptions(env)`,
and MUST NOT inline `requireEnv(process.env, "REDIS_HOST")` or
`Number(requireEnv(process.env, "REDIS_PORT"))`. The consumers are
`bullmq-options.ts` (`getBullMQConnectionOptions`), `redis.health.ts`,
`session-revocation.service.ts`, `analytics.cache.ts`, and
`telemetry.cache.ts`. A consumer MAY add its own resilience flags
(`lazyConnect`, `maxRetriesPerRequest`, `enableOfflineQueue`) alongside the
spread, because those differ per consumer and are not env-derived.

#### Scenario: A consumer builds its connection from the helper

- **WHEN** `getBullMQConnectionOptions` constructs its connection options
- **THEN** its `host`/`port` come from `buildRedisConnectionOptions(env)`
- **AND** its own `maxRetriesPerRequest: null` is preserved alongside the spread

#### Scenario: No consumer re-reads process.env for host or port

- **WHEN** the five named consumers are searched for Redis connection reads
- **THEN** none contains `requireEnv(process.env, "REDIS_HOST")` or
  `Number(requireEnv(process.env, "REDIS_PORT"))`
- **AND** each resilience flag value that existed before the change is unchanged
  after it (behavior-preserving)

### Requirement: A missing REDIS_HOST or REDIS_PORT MUST fail boot loud

The env schema MUST keep `REDIS_HOST` and `REDIS_PORT` REQUIRED with no
`.default()`, so a deploy that omits either fails validation at boot rather than
silently connecting to a wrong host or port. This preserves the no-silent-default
contract (`lint-max-strictness-standard`) after the connection read is
centralized: the single builder reads only already-validated values, so there is
exactly one place the fields are consumed and no place a fallback can reappear.

#### Scenario: Boot fails when REDIS_HOST is unset

- **WHEN** `validateEnv()` runs with `REDIS_HOST` unset
- **THEN** validation fails and `validateEnv()` calls `process.exit(1)` rather
  than returning a config
- **AND** no consumer ever reaches `buildRedisConnectionOptions` with a missing
  host

#### Scenario: Boot fails when REDIS_PORT is not a positive integer

- **WHEN** `validateEnv()` runs with `REDIS_PORT` set to `"not-a-number"`
- **THEN** validation fails on path `REDIS_PORT` (via `z.coerce.number().int().positive()`)
- **AND** boot aborts before any Redis connection is constructed
