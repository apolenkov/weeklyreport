## Why

`Dockerfile.web` defines `NEXT_PUBLIC_AUTH_STUB=true` and
`NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` as default `ARG` values for the Next.js
build stage. `docker-compose.prod.yml` passes no `build.args` for the `web`
service, so the dev defaults compile into the client bundle. Because
`NEXT_PUBLIC_*` variables are inlined at build time, runtime environment
variables cannot override them. Every anonymous visitor to the production login
page sees the dev-login picker ("Enter Application") instead of the SSO button.

A related build-time bug affects the API origin. The browser tRPC client uses a
relative `/trpc` URL, which `next.config.ts` rewrites proxy to `API_URL`.
Next.js bakes rewrite destinations at **build time** into `routes-manifest.json`,
but `docker-compose.prod.yml` supplies `API_URL` only via the runtime
`environment:` block — too late. The build falls back to the Dockerfile default
`http://api:3002`, while the prod `api` service listens on internal port `3001`,
so the baked rewrites point at a dead address. Separately, the browser-inlined
`NEXT_PUBLIC_API_URL` (rendered as clickable `/health/*` and `/metrics` links)
falls back to `localhost:3002` instead of the real public origin.

## What Changes

- Add `build.args` to the `web` service in `docker-compose.prod.yml`:
  `NEXT_PUBLIC_AUTH_STUB=false`, `NEXT_PUBLIC_DEV_ROLE_SWITCHER=false`,
  `API_URL` bound to the internal API service origin (`http://api:3001`) so the
  build-time-baked rewrites proxy correctly, and `NEXT_PUBLIC_API_URL` bound to
  the public origin via required-error interpolation (`${VAR:?...}`) so an unset
  value fails the build hard. The build args are additive to the existing
  runtime `environment:` block.
- Add a `NODE_ENV === 'production'` guard to the `AUTH_STUB` derivation in
  `login-page.client.tsx` as defense-in-depth against a future misconfigured
  build.
- Dockerfile.web ARG defaults stay `true` — they are correct for
  `docker-compose.yml` (base dev) and `docker-compose.dev.yml`, both of which
  pass `NEXT_PUBLIC_AUTH_STUB=true` explicitly.

**Non-goals:**

- Changing dev or UAT compose files.
- Moving `NEXT_PUBLIC_*` out of the Dockerfile ARG pattern.
- Addressing any other P0 findings (tracked in separate changes).

## Capabilities

### New Capabilities

- `prod-web-build-hardening`: Production web Docker image SHALL be built with
  auth-stub disabled, dev controls disabled, the public API origin baked in for
  browser-inlined consumers, and the internal API origin baked in for the
  build-time rewrites; the `AUTH_STUB` derivation SHALL be guarded by `NODE_ENV`
  as a secondary safety net.

### Modified Capabilities

_(none — no existing spec governs the production Docker build configuration)_

## Impact

- **`docker-compose.prod.yml`** — `web.build.args` block added (`AUTH_STUB`,
  `DEV_ROLE_SWITCHER`, `API_URL`, `NEXT_PUBLIC_API_URL`); runtime
  `environment:` block kept.
- **`Dockerfile.web`** — no changes to ARG defaults (stays dev-safe).
- **`apps/web/src/app/login-page.client.tsx`** — `AUTH_STUB` derivation line
  gains `&& process.env.NODE_ENV !== 'production'`.
- **Adjacent change** — `fix-open-redirect-next-param` also touches
  `login-page.client.tsx`; sequence this change first (or merge the
  `login-page.client.tsx` edits in one commit) to avoid a conflict.
