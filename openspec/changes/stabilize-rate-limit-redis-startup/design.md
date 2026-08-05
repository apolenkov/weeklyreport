## Context

The rate-limit client is created with `lazyConnect: true` and `enableOfflineQueue: false`. IORedis therefore rejects a command issued before readiness. `rate-limit-redis` initializes stores during synchronous HTTP pipeline construction, so the first command can be treated as an outage even when Redis is healthy.

## Goals / Non-Goals

**Goals:** remove the healthy-start race, retain explicit required Redis configuration, and retain observable bounded local enforcement for faults after startup.

**Non-Goals:** change rate budgets, make the API depend on Docker application images, remove degraded enforcement, or consolidate unrelated Redis clients.

## Decisions

### 1. Await only the internally owned client at the boot boundary

Make `createRateLimits` asynchronous. When it creates the IORedis client from validated environment values, explicitly await `connect()` before constructing `RedisStore` instances. `configureHttpPipeline` and its bootstrap caller await that factory, so ingress cannot receive traffic first.

Injected clients remain caller-owned and are not connected or closed by the factory. This preserves deterministic fakes and integration-test lifecycle ownership.

Alternative rejected: enable the offline queue. Queuing hides whether the shared store is actually ready and can make a failed dependency delay a request unpredictably.

Alternative rejected: suppress the initial error. That would make logs quieter without fixing the temporary enforcement downgrade.

### 2. Preserve post-start degraded enforcement

Store command failures and client error events continue to increment the existing metric, emit the existing structured error, and fall back to `RateLimitDegradedStore`. Only the false healthy-start transition is removed.

## Risks / Trade-offs

- Redis unavailable at boot now blocks/fails limiter construction rather than accepting ingress with a false healthy dependency. This matches the existing fail-loud required-store policy.
- Async factory propagation touches several tests; focused TypeScript and unit/integration suites verify every caller awaits the result.

## Verification

Run focused rate-limit tests, Redis integration tests, API typecheck/ESLint, then restart the source API against the minimal Postgres/Redis stack. Assert readiness is green, startup logs contain zero rate-limit store errors, and a request creates a shared `rl:*` key.
