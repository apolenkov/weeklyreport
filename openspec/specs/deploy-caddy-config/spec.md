## Purpose

Defines the Caddy reverse-proxy configuration guarantees for prod and staging deployments.

## Requirements

### Requirement: Staging and prod Caddyfiles carry matching security-header floors

The security `header` block in `deploy/caddy/Caddyfile.staging` MUST set the
same header set as `deploy/caddy/Caddyfile`, including
`Strict-Transport-Security` and `Content-Security-Policy-Report-Only`, with
matching directive values. Staging MUST NOT ship with a lower security-header
floor than prod, so any header validated in staging reflects what prod
actually sends. A future change that flips the CSP directive from
`Report-Only` to enforcing MUST update both files together.

#### Scenario: staging response carries the same header floor as prod

- **WHEN** a client requests any page through `Caddyfile.staging`
- **THEN** the response includes `Strict-Transport-Security` with the same
  `max-age`, `includeSubDomains`, and `preload` directives as the prod
  `Caddyfile`
- **AND** the response includes `Content-Security-Policy-Report-Only` with
  the same policy string as the prod `Caddyfile`

#### Scenario: a future CSP enforcing flip touches both files

- **WHEN** the `TODO` on the CSP directive is resolved and the policy moves
  from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
- **THEN** the same edit is applied to both `Caddyfile` and
  `Caddyfile.staging` in the same change, so staging keeps exercising the
  policy that will actually run in prod

### Requirement: The `@api` matcher routes `/api/*` directly to the api container

The `@api` path matcher MUST include `/api` and `/api/*` in both
`deploy/caddy/Caddyfile` and `deploy/caddy/Caddyfile.staging`, alongside the
existing `/trpc`, `/auth`, `/health`, `/admin/queues`, and `/pdfs` prefixes,
so that any endpoint served by the api under the `/api` path is fronted
directly by `api:3001` over a single reverse-proxy hop rather than falling
through to the `web:3000` catch-all and being re-proxied by the Next.js
`/api` rewrite.

#### Scenario: an `/api/*` request is proxied directly to the api container

- **WHEN** a request path starts with `/api/`
- **THEN** Caddy's `@api` matcher selects it
- **AND** the request is reverse-proxied straight to `api:3001`, not to
  `web:3000`

#### Scenario: staging and prod matchers stay identical for `/api`

- **WHEN** a maintainer diffs the `@api` path list between `Caddyfile` and
  `Caddyfile.staging`
- **THEN** both list the same prefixes, including `/api /api/*`
