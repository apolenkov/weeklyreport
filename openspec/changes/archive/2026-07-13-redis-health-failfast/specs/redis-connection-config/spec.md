## ADDED Requirements

### Requirement: The readiness Redis client MUST fail fast

The `RedisHealthIndicator` ioredis client MUST set `maxRetriesPerRequest: 1`
and a bounded `commandTimeout` (2s), and MUST install a no-op `error` listener,
(the offline queue stays ENABLED: with `lazyConnect`, disabling it rejects the
first ping while the client is still connecting — a deterministic false "down"
at process start against a healthy Redis),
matching the `read-through-cache.ts` and `session-revocation.service.ts`
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
