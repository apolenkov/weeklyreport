## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

`RedisHealthIndicator` (`apps/api/src/infrastructure/health/redis.health.ts`)
constructs its ioredis client with only `host`/`port` and `lazyConnect:
true`, and installs no `error` listener. With ioredis's defaults
(`maxRetriesPerRequest: 20`, offline queue on) a `ping()` issued while
Redis is down is queued behind roughly 20 reconnect attempts before it
rejects — around 10 to 40 seconds — so `/health/ready` still resolves
`down`, but far slower than any sane probe timeout, and every reconnect
attempt dumps a raw, unhandled `error` event to stderr in the meantime.
The sibling `read-through-cache.ts` client and
`session-revocation.service.ts` both already set `maxRetriesPerRequest: 1`,
`enableOfflineQueue: false`, and a no-op `error` listener; the readiness
client is the one outlier that never adopted this pattern.

## What Changes

- `apps/api/src/infrastructure/health/redis.health.ts`: add
  `maxRetriesPerRequest: 1` and `enableOfflineQueue: false` to the ioredis
  client options (alongside the existing `lazyConnect: true`), and add
  `this.redis.on("error", () => undefined)` in the constructor, mirroring
  `read-through-cache.ts` and `session-revocation.service.ts` exactly. No
  change to `isHealthy`'s try/catch-to-`down()` mapping, to
  `onModuleDestroy`, or to the `/health/ready` response contract.

## Impact

- `apps/api/src/infrastructure/health/redis.health.ts`
