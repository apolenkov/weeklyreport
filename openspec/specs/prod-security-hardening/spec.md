# prod-security-hardening Specification

## Purpose

Hardens the production deploy surface (edge CSP enforcement, image supply-chain pinning, and dev-auth build flag defaults) against silent regressions.

## Requirements

### Requirement: The production CSP MUST enforce, not just report

The Caddy edge proxy MUST send an enforcing `Content-Security-Policy`
header on production responses, not `Content-Security-Policy-Report-Only`.
The header MUST include a `report-uri` or `report-to` target so violations
remain observable after the flip. It is the only CSP layer in the deploy
(no equivalent header is set inside the Next.js app), so it MUST NOT be
absent or empty.

#### Scenario: A production response carries an enforcing CSP header

- **WHEN** a browser requests any page from the production Caddy edge
- **THEN** the response includes a `Content-Security-Policy` header (not
  `Content-Security-Policy-Report-Only`)
- **AND** the header value includes a `report-uri` or `report-to` directive

#### Scenario: A CSP violation is both blocked and reported

- **WHEN** a script attempts to load from a origin outside `default-src
'self'`
- **THEN** the browser blocks the load
- **AND** the browser sends a violation report to the configured
  `report-uri`/`report-to` target

### Requirement: Every base image MUST be pinned by digest, not mutable tag

Every `FROM` instruction in `Dockerfile.web` and `Dockerfile.api` MUST be
pinned by `@sha256:<digest>`. Every third-party service image reference in
`deploy/helm/weeklyreport/values.yaml` MUST carry a reviewed digest pin, so a registry-side
repush of a mutable tag cannot silently change what a rebuild deploys.

#### Scenario: A Dockerfile FROM line is digest-pinned

- **WHEN** a reviewer inspects `Dockerfile.web` or `Dockerfile.api`
- **THEN** every `FROM` instruction includes `@sha256:` followed by a
  64-hex-character digest
- **AND** no `FROM` instruction references a bare tag with no digest

#### Scenario: A production chart image is digest-pinned

- **WHEN** a reviewer inspects `deploy/helm/weeklyreport/values.yaml`
- **THEN** every third-party image value for `postgres`, `pgbouncer`, `redis`,
  `caddy`, and `gotenberg` includes an `@sha256:` digest alongside its tag

### Requirement: The web image's dev-auth build args default to safe values

The web image's two dev-auth build args MUST default to `false` in
`Dockerfile.web`: `ARG NEXT_PUBLIC_AUTH_STUB` and `ARG
NEXT_PUBLIC_DEV_ROLE_SWITCHER`. An un-argumented build (a direct
`docker build`, a CI job, or a compose file that omits `build.args`) then
never inlines the dev-auth stub or dev role switcher into a
production-labeled bundle. Environments that need either flag on (the dev
`docker-compose.yml`) MUST pass it explicitly via `build.args`.

#### Scenario: An un-argumented build ships the safe default

- **WHEN** `Dockerfile.web` is built with no `--build-arg` for either flag
- **THEN** the built image was compiled with `NEXT_PUBLIC_AUTH_STUB=false`
  and `NEXT_PUBLIC_DEV_ROLE_SWITCHER=false`

#### Scenario: The dev compose file still opts in explicitly

- **WHEN** `docker-compose.yml` (dev) builds the `web` service
- **THEN** its `build.args` explicitly set both flags to `"true"`
- **AND** the resulting dev image still shows the dev role switcher and
  auth stub
