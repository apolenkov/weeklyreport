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

A secondary issue: the Dockerfile default `API_URL=http://api:3002` is an
internal Docker hostname at port 3002, while `docker-compose.prod.yml` runtime
environment sets `NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://api:3001}`
(port 3001). The runtime env is irrelevant for `NEXT_PUBLIC_*` (already
inlined), so the mismatch is latent but the actual public API origin must be
supplied explicitly in `docker-compose.prod.yml` build args.

## Goals / Non-Goals

**Goals:**

- The production web image bakes `AUTH_STUB=false`, disabling dev-login.
- The production web image bakes `DEV_ROLE_SWITCHER=false`.
- The production web image bakes the real `NEXT_PUBLIC_API_URL` (supplied via
  environment-variable interpolation so each deployment controls its own
  origin).
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

### Decision 2: `NEXT_PUBLIC_API_URL` is supplied via env interpolation, not a hard-coded value

The public API origin is deployment-specific. Using
`NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}` (no fallback) forces the
operator to supply the value and prevents a silent fallback to localhost. The
`.env.example` file SHOULD document this required var.

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
  Docker Compose will emit an error on unset vars when no default is provided,
  making the omission visible at deploy time. Document the var in
  `.env.example`.

- **[Risk] A future staging/UAT compose still lacks build args** →
  The `NODE_ENV` guard on `AUTH_STUB` provides a partial safety net (the Next.js
  runner always exports `NODE_ENV=production` in standalone mode), but the API
  URL would still default to localhost. Document the three required build args
  in `.env.example` and in ops runbook commentary in `docker-compose.prod.yml`.

- **[Trade-off] No automated test verifies build-arg correctness** →
  Shell-level integration testing of the Docker build is out of scope for
  this change. The Playwright E2E catalog could include a smoke-test that the
  production login page renders an SSO button and not a dev-login CTA, but
  that requires a production-built image in CI. Noted as a future improvement.

## Migration Plan

1. Update `docker-compose.prod.yml`: add `web.build.args` with the three
   prod-safe values.
2. Update `apps/web/src/app/login-page.client.tsx`: extend the `AUTH_STUB`
   constant with `&& process.env.NODE_ENV !== 'production'`.
3. Update `.env.example`: document `NEXT_PUBLIC_API_URL` as a required
   production build arg.
4. Rebuild the production web image (`docker compose -f docker-compose.prod.yml
build web`).
5. Smoke-test the login page: SSO button visible, no dev-login picker, network
   tab shows tRPC calls to the correct origin.

No rollback is needed — reverting the compose change and rebuilding restores the
previous (broken) state.
