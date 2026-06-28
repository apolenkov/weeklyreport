## ADDED Requirements

### Requirement: Production web image disables auth stub

The production web Docker image SHALL be built with `NEXT_PUBLIC_AUTH_STUB=false`
so that the login page renders the SSO sign-in path and never exposes
dev-login affordances to anonymous visitors.

#### Scenario: Production login shows SSO button

- **WHEN** the web service is built via `docker-compose.prod.yml`
- **THEN** the compiled client bundle has `NEXT_PUBLIC_AUTH_STUB` inlined as `false`
- **AND** the login page renders the "Sign in with SSO" CTA
- **AND** no dev-login picker or "Enter Application" CTA is rendered

#### Scenario: Dev compose is unaffected

- **WHEN** the web service is built via `docker-compose.yml` or `docker-compose.dev.yml`
- **THEN** `NEXT_PUBLIC_AUTH_STUB` is still `true` (passed explicitly by those files)
- **AND** the dev-login picker continues to appear for local development

### Requirement: Production web image disables dev role-switcher build arg

The production web Docker image SHALL be built with
`NEXT_PUBLIC_DEV_ROLE_SWITCHER=false` so the dev role-switcher is not compiled
into the production bundle.

#### Scenario: Dev role-switcher build arg is false in production

- **WHEN** the web service is built via `docker-compose.prod.yml`
- **THEN** the compiled bundle has `NEXT_PUBLIC_DEV_ROLE_SWITCHER` inlined as `false`

### Requirement: Production web image bakes the public API origin for browser-inlined consumers

The production web Docker image SHALL be built with `NEXT_PUBLIC_API_URL` bound
to the public-facing, browser-reachable API origin (not `localhost`) so that
the browser-facing components that inline this value — the API-readiness
placeholder renders clickable `/health/*` and `/metrics` links from it — resolve
to an address the user's browser can reach. (The browser tRPC client uses a
relative `/trpc` URL and does not read this value; see the separate
internal-origin requirement for the rewrite path.)

#### Scenario: API URL is not localhost in production build

- **WHEN** the web service is built via `docker-compose.prod.yml` with
  `NEXT_PUBLIC_API_URL` set to the deployment origin
- **THEN** the compiled bundle contains the public origin, not `localhost`

#### Scenario: Missing env var fails the build hard

- **WHEN** `NEXT_PUBLIC_API_URL` is not provided in the deployment environment
- **THEN** the build arg uses required-error interpolation
  (`${NEXT_PUBLIC_API_URL:?...}`) so Docker Compose aborts with an error before
  the build starts
- **AND** the build does not proceed with an empty substituted value (the bare
  `${NEXT_PUBLIC_API_URL}` form, which only warns, is not used)

### Requirement: Production web image bakes the internal API origin for build-time rewrites

The production web Docker image SHALL be built with the non-public `API_URL`
build arg set to the API's internal service origin (`http://api:3001`) so that
the `next.config.ts` rewrites for `/trpc`, `/auth`, `/health`, and `/api` —
which Next.js evaluates once at build time and bakes into `routes-manifest.json`
— proxy to the correct internal endpoint rather than the dev-only Dockerfile
default `http://api:3002`.

#### Scenario: Rewrites are baked to the internal API origin, not the stale default

- **WHEN** the web service is built via `docker-compose.prod.yml`
- **THEN** the baked rewrites in `routes-manifest.json` target the internal API
  service origin (`http://api:3001`)
- **AND** they do not target the Dockerfile ARG default `http://api:3002`
- **AND** a same-origin browser request to `/trpc` is proxied to the running API

#### Scenario: Build arg matches the API service internal listen port

- **WHEN** the prod compose `api` service listens on internal port `3001`
- **THEN** the `web` service `API_URL` build arg resolves to that same internal
  origin so the build-time rewrite destination and the runtime API port agree

### Requirement: AUTH_STUB derivation is guarded by NODE_ENV

The `AUTH_STUB` constant in `apps/web/src/app/login-page.client.tsx` SHALL
evaluate to `false` when `NODE_ENV` is `production`, regardless of the inlined
`NEXT_PUBLIC_AUTH_STUB` value, as a defense-in-depth safeguard against
accidental misconfigurations in future build pipelines.

#### Scenario: NODE_ENV guard prevents auth stub in production

- **WHEN** the Next.js runtime executes in `NODE_ENV=production`
- **THEN** `AUTH_STUB` is `false` even if `NEXT_PUBLIC_AUTH_STUB` is `true`

#### Scenario: NODE_ENV guard does not affect development

- **WHEN** the Next.js runtime executes in `NODE_ENV=development`
- **THEN** `AUTH_STUB` derives solely from `NEXT_PUBLIC_AUTH_STUB`
