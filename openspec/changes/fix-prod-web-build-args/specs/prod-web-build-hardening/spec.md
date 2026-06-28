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

### Requirement: Production web image bakes the public API origin

The production web Docker image SHALL be built with `NEXT_PUBLIC_API_URL` bound
to the public-facing API origin (not `localhost` or an internal Docker hostname)
so the client-side tRPC calls reach the correct endpoint.

#### Scenario: API URL is not localhost in production build

- **WHEN** the web service is built via `docker-compose.prod.yml` with
  `NEXT_PUBLIC_API_URL` set to the deployment origin
- **THEN** the compiled bundle contains the public origin, not `localhost`

#### Scenario: Missing env var is detected before build

- **WHEN** `NEXT_PUBLIC_API_URL` is not provided in the deployment environment
- **THEN** the operator is able to detect the misconfiguration from the compose
  file before starting the build (no silent fallback to a localhost default)

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
