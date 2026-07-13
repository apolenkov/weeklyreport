## Why

Wave 1 / P1 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

Two public HTTP ingress surfaces on the api bootstrap accept unauthenticated,
unbounded request volume:

- **`/api/client-logs` has no rate limit.** The browser→server log forwarder is
  mounted (`apps/api/src/main.ts:282-325`) with only
  `express.json({ limit: "128kb" })` and terminates the request in its own
  handler without calling `next()`, so the `vitalsLimiter`/`trpcLimiter`
  registered later never see it and no Nest guard applies. When
  `clientLogsEnabled` (dev default `true`; prod when `CLIENT_LOG_FORWARDING=true`,
  a supported flag wired at `docker-compose.prod.yml:190`) any unauthenticated
  caller can POST an unbounded number of requests, each writing up to
  `MAX_CLIENT_LOG_BATCH_SIZE` (100) lines into the shared rotating `app.log`.
  The file sink (`apps/api/src/lib/logger-file-sink.ts:74-106`) does size-based
  rotation with age-only pruning and no total-size cap, so this is a practical
  unauthenticated log-flood / disk-fill. Its sibling public beacon
  `/api/web-vitals` **is** rate-limited (`vitalsLimiter`). Because
  `/api/client-logs` is not in the Caddyfile `@api` matcher
  (`deploy/caddy/Caddyfile:33-58`) it falls through to the public web origin,
  so the edge proxy provides no mitigation — contrary to the "already covered
  by upstream/edge proxy" note in `rate-limit.middleware.ts`.

- **The tRPC express adapter has no explicit request-body bound.**
  `trpcExpress.createExpressMiddleware` is mounted (`apps/api/src/main.ts:434-441`)
  with no `maxBodySize` and no preceding `express.json({ limit })`, so it relies
  on the adapter's undocumented default. The neighbouring `/api/client-logs`
  handler sets its `128kb` limit explicitly; the tRPC ingress should be equally
  explicit and auditable.

## What Changes

- Add a fourth limiter, `clientLogsLimiter`, to `createRateLimits`
  (`apps/api/src/infrastructure/throttler/rate-limit.middleware.ts`), built from
  the same `baseConfig` as the other three (per-IP keying via `ipKeyGenerator`,
  `rateLimitHitsTotal` accounting under a `"client-logs"` bucket, `429`
  response). Give it its own named per-minute constant sized like the vitals
  beacon (a page emits a small, bounded burst of client-log batches).
- Mount `clientLogsLimiter` on `CLIENT_LOGS_ROUTE` in `apps/api/src/main.ts`
  **before** the existing `express.json({ limit: "128kb" })` + handler, so it
  keys per real client IP (`trust proxy: 1` is already set) and runs ahead of
  the terminating handler.
- Bound the tRPC ingress explicitly: pass `maxBodySize` to
  `trpcExpress.createExpressMiddleware` (or mount `express.json` with an explicit
  limit before it) using a named byte constant, so the tRPC body limit is
  visible and audited rather than implicit.
- Update the `createRateLimits` doc block so the tier table lists
  `/api/client-logs` and no longer implies the edge proxy covers unlisted
  routes.
- Tests: assert the `clientLogsLimiter` bucket exists and is wired; add an api
  integration test that a `/api/client-logs` request stream over the limit
  returns `429`, and that an oversized tRPC mutation body is rejected (`413`).

## Capabilities

### New Capabilities

- `public-endpoint-resource-limits`: every unauthenticated HTTP ingress surface
  on the api bootstrap is bounded — rate-limited per IP and body-size capped
  with an explicit, auditable limit.

### Modified Capabilities

(none)

## Impact

- `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts` (add
  `clientLogsLimiter` + its constant; correct the tier doc block)
- `apps/api/src/main.ts` (mount `clientLogsLimiter` before the client-logs
  handler; pass an explicit body-size limit to the tRPC adapter)
- api test suite (limiter wiring; `429` on client-logs flood; `413` on oversized
  tRPC body)

Non-goals: no change to the client-logs payload caps (`MAX_CLIENT_LOG_*`), the
file-sink rotation/pruning policy, or the `CLIENT_LOG_FORWARDING` default;
no new edge-proxy rules in the Caddyfile; the existing auth/trpc/vitals limits
are unchanged.
