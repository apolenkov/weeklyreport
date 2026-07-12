## MODIFIED Requirements

### Requirement: Every Redis consumer MUST obtain host/port from the builder

Each API consumer that constructs an ioredis client or a BullMQ connection MUST
obtain its `host` and `port` by spreading `buildRedisConnectionOptions(env)`,
and MUST NOT inline `requireEnv(process.env, "REDIS_HOST")` or
`Number(requireEnv(process.env, "REDIS_PORT"))`. The consumers are
`bullmq-options.ts` (`getBullMQConnectionOptions`), `redis.health.ts`,
`session-revocation.service.ts`, `analytics.cache.ts`, `telemetry.cache.ts`,
and `rate-limit.middleware.ts` (the `rate-limit-redis` store's ioredis
client). A consumer MAY add its own resilience flags (`lazyConnect`,
`maxRetriesPerRequest`, `enableOfflineQueue`) alongside the spread, because
those differ per consumer and are not env-derived.

#### Scenario: A consumer builds its connection from the helper

- **WHEN** `getBullMQConnectionOptions` constructs its connection options
- **THEN** its `host`/`port` come from `buildRedisConnectionOptions(env)`
- **AND** its own `maxRetriesPerRequest: null` is preserved alongside the spread

#### Scenario: No consumer re-reads process.env for host or port

- **WHEN** the six named consumers are searched for Redis connection reads
- **THEN** none contains `requireEnv(process.env, "REDIS_HOST")` or
  `Number(requireEnv(process.env, "REDIS_PORT"))`
- **AND** each resilience flag value that existed before the change is unchanged
  after it (behavior-preserving)

#### Scenario: The rate-limit Redis store builds its client from the helper

- **WHEN** `rate-limit.middleware.ts` constructs the ioredis client backing
  its `RedisStore`
- **THEN** its `host`/`port` come from `buildRedisConnectionOptions(env)`
- **AND** it reads neither `process.env.REDIS_HOST` nor
  `process.env.REDIS_PORT` directly
