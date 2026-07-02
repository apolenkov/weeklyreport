## 1. Bootstrap fix — API main.ts

- [ ] 1.1 In `apps/api/src/main.ts`, immediately after the line that retrieves
      the raw Express instance (`const expressApp = app.getHttpAdapter().getInstance()`),
      add `expressApp.set('trust proxy', 1)` with a brief comment explaining the
      single-hop Caddy topology and noting the historical audit-IP gap.

## 2. Remove false comment — rate-limit middleware

- [ ] 2.1 In `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts`,
      delete the two comment lines that claim `app.set('trust proxy', 1)` is set
      upstream (currently lines 32–33). Leave the `keyGenerator` code intact.

## 3. Unit test — IP resolution from X-Forwarded-For

- [ ] 3.1 Create
      `apps/api/src/infrastructure/throttler/rate-limit.middleware.test.ts`.
      Write a Vitest test suite that:
  - Spins up a minimal `express()` instance with `trust proxy` set to `1`.
  - Mounts the `authLimiter` from `createRateLimits`.
  - Sends a synthetic request with `X-Forwarded-For: 203.0.113.42` and socket
    `remoteAddress` of `172.18.0.2`.
  - Asserts the `keyGenerator` receives `req.ip === '203.0.113.42'`.
- [ ] 3.2 Add a second test case covering the fallback scenario: no
      `X-Forwarded-For` header, socket `remoteAddress` of `127.0.0.1`, assert
      `req.ip === '127.0.0.1'`.

## 4. Production-safety prerequisite — direct API host port

- [ ] 4.1 Before enabling trust proxy in production, verify the API container
      port is no longer host-published in `docker-compose.prod.yml` (the
      `${API_PORT:-3001}:3001` mapping is removed or bound to localhost). This is
      owned by the deploy-seam concern `BL-DEPLOY-SEAM-MISC`; do NOT edit
      `docker-compose.prod.yml` in this change. If the port is still published,
      surface it as a hard blocker and hold the production rollout — see
      Decision 5 / Dependency in `design.md`.

## 5. Quality gates

- [ ] 5.1 Run `pnpm typecheck` from the repo root — zero errors.
- [ ] 5.2 Run `pnpm lint` from the repo root — zero errors or warnings.
- [ ] 5.3 Run `pnpm test` from the repo root — all tests pass, including the
      new rate-limit unit tests.
- [ ] 5.4 Run `pnpm build` from the repo root — build succeeds.
