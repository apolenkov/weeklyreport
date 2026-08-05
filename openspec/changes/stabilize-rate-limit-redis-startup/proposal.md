## Why

The source API starts healthy against Redis, but its first rate-limit store commands race the lazy connection and emit four false outage errors before Redis becomes ready. Those requests temporarily use per-process enforcement even though the configured shared store is available, weakening startup observability and making clean runtime evidence impossible.

## What Changes

- Make production rate-limit construction await the internally owned Redis client's ready state before any ingress handler can receive traffic.
- Preserve test-mode MemoryStore, injected-client test seams, and bounded local enforcement for Redis faults after startup.
- Add regression coverage for startup readiness and verify a source boot has no rate-limit store error while shared Redis counters are written.

## Capabilities

### New Capabilities

- `rate-limit-store-readiness`: Defines readiness and degraded-enforcement behavior for the API ingress rate-limit Redis store.

### Modified Capabilities

None.

## Impact

- API bootstrap and rate-limit middleware factory become asynchronous.
- Focused unit/integration tests await limiter construction.
- No route, rate budget, public contract, schema, or migration changes.
