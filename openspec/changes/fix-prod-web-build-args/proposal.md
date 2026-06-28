## Why

`Dockerfile.web` defines `NEXT_PUBLIC_AUTH_STUB=true` and
`NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` as default `ARG` values for the Next.js
build stage. `docker-compose.prod.yml` passes no `build.args` for the `web`
service, so the dev defaults compile into the client bundle. Because
`NEXT_PUBLIC_*` variables are inlined at build time, runtime environment
variables cannot override them. Every anonymous visitor to the production login
page sees the dev-login picker ("Enter Application") instead of the SSO button,
and the client targets `localhost:3002` as the API origin instead of the real
public URL.

## What Changes

- Add `build.args` to the `web` service in `docker-compose.prod.yml`:
  `NEXT_PUBLIC_AUTH_STUB=false`, `NEXT_PUBLIC_DEV_ROLE_SWITCHER=false`, and
  `NEXT_PUBLIC_API_URL` bound to the public origin via env interpolation.
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
  auth-stub disabled, dev controls disabled, and the public API origin baked in;
  the `AUTH_STUB` derivation SHALL be guarded by `NODE_ENV` as a secondary
  safety net.

### Modified Capabilities

_(none — no existing spec governs the production Docker build configuration)_

## Impact

- **`docker-compose.prod.yml`** — `web.build.args` block added.
- **`Dockerfile.web`** — no changes to ARG defaults (stays dev-safe).
- **`apps/web/src/app/login-page.client.tsx`** — `AUTH_STUB` derivation line
  gains `&& process.env.NODE_ENV !== 'production'`.
- **Adjacent change** — `fix-open-redirect-next-param` also touches
  `login-page.client.tsx`; sequence this change first (or merge the
  `login-page.client.tsx` edits in one commit) to avoid a conflict.
