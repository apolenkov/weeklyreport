## Context

`Dockerfile.web` uses a multi-stage build with ARG declarations in the builder
stage:

```
ARG NEXT_PUBLIC_AUTH_STUB=true
ARG NEXT_PUBLIC_DEV_ROLE_SWITCHER=true
ARG NEXT_PUBLIC_API_URL=http://localhost:3002
```

Next.js inlines `NEXT_PUBLIC_*` values at **build time** — they become string
literals in the compiled JavaScript bundle. Runtime environment variables
cannot change them after the image is built.

`docker-compose.yml` (base dev) and `docker-compose.dev.yml` both pass the
correct dev values in their `build.args` blocks. `docker-compose.prod.yml`
has no `build.args` for the `web` service, so the Dockerfile defaults
(`AUTH_STUB=true`, `API_URL=localhost:3002`) compile into every production
image.

A secondary, non-public issue: `next.config.ts` builds its rewrites for
`/trpc`, `/auth`, `/health`, and `/api` from the server-side `API_URL`
(falling back to `NEXT_PUBLIC_API_URL`, then `http://localhost:3002`). Next.js
evaluates `rewrites()` **once at build time** and bakes the destinations into
`routes-manifest.json`; the standalone server reads the manifest at runtime and
does **not** re-run `rewrites()` (confirmed against the Next.js
`loadCustomRoutes` / `filesystem.ts` behaviour). The Dockerfile default is
`API_URL=http://api:3002`, but the prod `api` service listens on internal port
`3001`, so the baked rewrites point at a dead `http://api:3002`. The runtime
`environment: API_URL` on the `web` service is too late to fix the baked
rewrites — `API_URL` must therefore also be a **build arg**.

This is the path that actually breaks the browser: the tRPC client uses a
relative `url: "/trpc"` (`apps/web/src/lib/trpc.ts`), so the browser hits the
web origin and relies on the baked rewrite to reach the API. `NEXT_PUBLIC_API_URL`
is a separate concern — it is inlined into the client bundle and rendered as
browser-clickable `/health/*` and `/metrics` links by the API-readiness
placeholder, so it must be the public, browser-reachable origin.

## Goals / Non-Goals

**Goals:**

- The production web image bakes `AUTH_STUB=false`, disabling dev-login.
- The production web image bakes `DEV_ROLE_SWITCHER=false`.
- The production web image bakes the real `NEXT_PUBLIC_API_URL` (the public,
  browser-reachable origin, supplied via required-error interpolation so each
  deployment controls its own origin and a missing value fails the build).
- The production web image bakes the non-public `API_URL` build arg pointing at
  the internal API service origin (`http://api:3001`) so the build-time-baked
  `next.config.ts` rewrites proxy `/trpc`, `/auth`, `/health`, `/api` correctly.
- `AUTH_STUB` derivation in `login-page.client.tsx` acquires a `NODE_ENV`
  guard as a second line of defence.
- Dev and UAT compose files are unmodified.

**Non-Goals:**

- Moving `NEXT_PUBLIC_*` out of the ARG/build-time pattern.
- Changing the Dockerfile ARG defaults (they must remain dev-safe for the
  other compose files that use them).
- Addressing other P0 findings from the review (tracked separately).

## Decisions

### Decision 1: Add build args to `docker-compose.prod.yml` rather than flipping Dockerfile defaults

`docker-compose.yml` and `docker-compose.dev.yml` explicitly pass
`NEXT_PUBLIC_AUTH_STUB=true`. Flipping the ARG defaults would have no effect
on those compose files (the explicit overrides win), so both approaches produce
the same dev outcome. The compose-level override is preferred because it keeps
the contract visible at the deployment boundary — a reader of
`docker-compose.prod.yml` sees every build-time decision without having to
check `Dockerfile.web`. Future environments (staging, UAT) can also set their
own values without modifying the shared Dockerfile.

### Decision 2: `NEXT_PUBLIC_API_URL` uses required-error interpolation, not bare `${VAR}`

The public API origin is deployment-specific, so it must be operator-supplied.
The bare `NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}` form does **not** enforce
this: Docker Compose substitutes an unset variable as an empty string and only
prints a warning — it does not abort. That would bake an empty origin into the
client bundle. The build arg therefore uses the required-error form
`NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:?NEXT_PUBLIC_API_URL must be set}`,
which makes Compose exit with an error before the build starts. The
`.env.example` file SHOULD document this required var.

### Decision 2b: `API_URL` build arg defaults to the internal service origin

Unlike the public origin, `API_URL` is the internal Docker-network address of
the API and is stable within the prod compose project (`http://api:3001`). It is
given a sensible default `API_URL: ${API_URL:-http://api:3001}` that mirrors the
existing runtime `environment:` block and never falls back to `localhost`. The
build args are **additive** to that runtime `environment:` block, which is kept
because it still feeds the server-side consumers (`resolveApiUrl` in
`get-server-session.ts` reads `API_URL` at runtime).

### Decision 3: Add `NODE_ENV !== 'production'` guard to `AUTH_STUB` derivation

The guard costs one boolean AND. It defends against an operator who accidentally
omits the build arg in a future CI pipeline. The guard does not change current
behaviour in dev (where `NODE_ENV=development`). The role-switcher
(`NEXT_PUBLIC_DEV_ROLE_SWITCHER`) is already `NODE_ENV`-guarded elsewhere
(confirmed in the review audit), so no guard is needed there.

### Decision 4: Sequence relative to `fix-open-redirect-next-param`

`fix-open-redirect-next-param` also modifies `login-page.client.tsx`. Both
changes are small, non-conflicting edits to the same file. The recommended
sequence is: apply `fix-prod-web-build-args` first (the AUTH_STUB guard edit
is on line 18), then apply `fix-open-redirect-next-param`. Alternatively,
implement both in a single commit.

## Risks / Trade-offs

- **[Risk] Operator forgets `NEXT_PUBLIC_API_URL` in deployment env** →
  The required-error interpolation `${NEXT_PUBLIC_API_URL:?...}` makes Docker
  Compose abort with an error before the build starts (the bare `${VAR}` form
  would only warn and substitute empty, so it is not used). Document the var in
  `.env.example`.

- **[Risk] A future staging/UAT compose still lacks build args** →
  The `NODE_ENV` guard on `AUTH_STUB` provides a partial safety net (the Next.js
  runner always exports `NODE_ENV=production` in standalone mode), but the
  public API URL would still default to localhost. Document the four build args
  in `.env.example` and in ops runbook commentary in `docker-compose.prod.yml`.

- **[Trade-off] No automated test verifies build-arg correctness** →
  Shell-level integration testing of the Docker build is out of scope for
  this change. The Playwright E2E catalog could include a smoke-test that the
  production login page renders an SSO button and not a dev-login CTA, but
  that requires a production-built image in CI. Noted as a future improvement.

- **[Dependency] `API_URL` build arg must track the API's internal listen
  port** → This change hardcodes the rewrite destination as `http://api:3001`
  to match the `api` service in `docker-compose.prod.yml` (internal port `3001`,
  per its `wget ... http://localhost:3001/health/ready` healthcheck). No other
  change in this review backlog owns the prod API port/publication, so there is
  no cross-change handoff here — but if a later change moves the API's internal
  port, the `web` service `API_URL` build arg (and the runtime `environment:`
  value) must move with it, or the baked rewrites break again.

## Migration Plan

1. Update `docker-compose.prod.yml`: add `web.build.args` with the four
   prod-safe values (`NEXT_PUBLIC_AUTH_STUB=false`,
   `NEXT_PUBLIC_DEV_ROLE_SWITCHER=false`,
   `API_URL=${API_URL:-http://api:3001}`,
   `NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:?...}`). Keep the existing runtime
   `environment:` block — the build args are additive.
2. Update `apps/web/src/app/login-page.client.tsx`: extend the `AUTH_STUB`
   constant with `&& process.env.NODE_ENV !== 'production'`.
3. Update `.env.example`: document `NEXT_PUBLIC_API_URL` as a required
   production build arg.
4. Rebuild the production web image (`docker compose -f docker-compose.prod.yml
build web`).
5. Smoke-test the login page: SSO button visible, no dev-login picker, and the
   same-origin `/trpc` requests are proxied to the internal API (no 502/404 from
   a stale `http://api:3002` rewrite destination).

No rollback is needed — reverting the compose change and rebuilding restores the
previous (broken) state.
