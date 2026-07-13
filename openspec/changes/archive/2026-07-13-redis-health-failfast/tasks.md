## 1. Fail-fast readiness client

- [ ] 1.1 `redis.health.ts`: add `maxRetriesPerRequest: 1` and
      a bounded `commandTimeout` to the `new Redis({...})` options object
      (offline queue stays enabled — disabling it false-negatives the first
      lazy-connect ping),
      alongside the existing `lazyConnect: true`
- [ ] 1.2 `redis.health.ts`: add `this.redis.on("error", () => undefined)`
      in the constructor, right after client construction, matching the
      comment and pattern in `read-through-cache.ts`
      (`// Suppress unhandled error events so a Redis blip cannot crash the
process.`)
- [ ] 1.3 Confirm no other behavior changes: `isHealthy`'s try/ping/catch
      mapping, `onModuleDestroy`, and the constructor's dependency-injection
      signature stay unchanged

## 2. Verification

- [ ] 2.1 `pnpm --filter @customreport/api db:generate`
- [ ] 2.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 2.3 Live-check: stop the dev Redis container, call `/health/ready`,
      and confirm the `redis` key resolves to `down` within roughly 1-2
      seconds instead of 10-40 seconds, with no raw ioredis error dump on
      stderr
- [ ] 2.4 `openspec validate redis-health-failfast --strict`
