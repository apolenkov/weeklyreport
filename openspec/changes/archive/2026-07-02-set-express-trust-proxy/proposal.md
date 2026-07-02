## Why

Behind the production Caddy edge, `req.ip` on every Express request resolves
to the Caddy container IP instead of the real client address, because
`expressApp.set('trust proxy', 1)` is never called in `main.ts`. A comment in
`rate-limit.middleware.ts` falsely asserts that it is set upstream. The impact
is immediate and severe: all clients share a single rate-limit bucket (the
auth throttle collapses to a 5-req/min global limit, nullifying brute-force
protection and risking org-wide lockout), and every audit row in the system
records the proxy IP rather than the client's real address.

Caveat (security prerequisite): enabling trust proxy is only safe when Caddy is
the sole ingress. The API container port is still host-published in
`docker-compose.prod.yml` (`${API_PORT:-3001}:3001`), so a non-Caddy caller
could forge `X-Forwarded-For` and spoof `req.ip` once trust proxy is on. Closing
that port is owned by the deploy-seam concern `BL-DEPLOY-SEAM-MISC`; this change
declares it a hard prerequisite for production enablement (see `design.md`).

## What Changes

- Add `expressApp.set('trust proxy', 1)` in `apps/api/src/main.ts`, before
  `createRateLimits` is called and before the tRPC adapter is mounted.
- Remove the false comment in `rate-limit.middleware.ts` that claims trust
  proxy is already set upstream.
- Add a unit test asserting that `req.ip` resolves from `X-Forwarded-For`
  when the middleware runs under the trust-proxy setting.

## Capabilities

### New Capabilities

- `express-trust-proxy`: Bootstrap must configure Express to trust the
  first proxy hop so that `req.ip` reflects the real client IP across
  rate-limiting, audit logging, and HTTP access logs.

### Modified Capabilities

_(none — no existing spec governs Express proxy trust or rate-limit IP
resolution)_

## Impact

- `apps/api/src/main.ts` — one-line addition before the rate-limit mount.
- `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts` — remove
  false comment (lines 32–33).
- `apps/api/src/infrastructure/trpc/trpc.context.ts` — no code change; its
  `req.ip` read is already trust-proxy-aware once the setting is added.
- New test file under `apps/api/src/infrastructure/throttler/` verifying
  IP resolution from `X-Forwarded-For`.
- No schema changes, no migration, no frontend changes.
- No breaking changes to the public API surface.
- Cross-change dependency — production enablement of trust proxy is gated on the
  API host port being closed (deploy-seam concern `BL-DEPLOY-SEAM-MISC`). No
  edit to `docker-compose.prod.yml` is made here; the dependency is documented
  in `design.md` and verified by a task before any prod rollout.
