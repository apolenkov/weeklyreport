## 1. Rate-limit /api/client-logs

- [ ] 1.1 `rate-limit.middleware.ts`: add a named per-minute constant for the
      client-logs bucket (sized like the vitals beacon — a page emits a small
      bounded burst of client-log batches), following the existing
      `VITALS_LIMIT_PER_MINUTE` shape
- [ ] 1.2 `rate-limit.middleware.ts`: build a `clientLogsLimiter` from the shared
      `baseConfig` with `message: "client-logs"`, add it to the factory's return
      type and returned object; keep the `isTest` bump so E2E suites use
      `TEST_MODE_LIMIT_PER_MINUTE`
- [ ] 1.3 `rate-limit.middleware.ts`: update the factory doc block — add
      `/api/client-logs` to the tier table and drop the wording implying unlisted
      routes are covered by the edge proxy (the Caddyfile does not match this
      route)
- [ ] 1.4 `main.ts`: destructure `clientLogsLimiter` from `createRateLimits` and
      mount it on `CLIENT_LOGS_ROUTE` as the first middleware, before the existing
      `express.json({ limit: "128kb" })` and the terminating handler, so it keys
      per real client IP and runs ahead of the handler

## 2. Bound the tRPC ingress body size

- [ ] 2.1 `main.ts`: add a named byte constant for the tRPC body limit and pass
      it as `maxBodySize` to `trpcExpress.createExpressMiddleware` (or mount
      `express.json` with that explicit limit before the tRPC middleware), so the
      tRPC ingress body bound is explicit and auditable rather than the adapter
      default

## 3. Tests

- [ ] 3.1 Unit: assert `createRateLimits` returns a `clientLogsLimiter` and that
      its rate-limit hits account under the `"client-logs"` bucket
- [ ] 3.2 Integration: a stream of `/api/client-logs` POSTs over the configured
      limit returns `429` with the shared rate-limit error body; a single request
      under the limit is accepted
- [ ] 3.3 Integration: a tRPC mutation whose serialized body exceeds the
      configured limit is rejected with `413` (payload too large)

## 4. Spec delta

- [ ] 4.1 `public-endpoint-resource-limits`: ADD the per-IP rate-limit
      requirement for every unauthenticated api ingress surface
- [ ] 4.2 `public-endpoint-resource-limits`: ADD the explicit body-size-bound
      requirement for the client-logs and tRPC ingress

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `pnpm test:integration` (single-thread; the `429`/`413` cases exercise
      the live express bootstrap)
- [ ] 5.4 `npx openspec validate rate-limit-public-endpoints --strict`
- [ ] 5.5 Adversarial review of the diff before archiving
