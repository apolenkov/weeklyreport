# deploy-caddy-config Specification

## Purpose

Define the production Caddy reverse-proxy contract for WeeklyReport.

## Requirements

### Requirement: Production API-owned paths route directly to the API

The `@api` matcher in `deploy/helm/weeklyreport/files/Caddyfile` MUST route the API-owned
prefixes (`/api/web-vitals`, `/api/client-logs`, `/trpc`, `/auth`, `/health`,
`/admin/queues`, and `/pdfs`, including their nested paths) directly to
`api:3001`. The matcher MUST NOT claim frontend-owned Next.js routes. The
public `/metrics` path MUST remain unavailable at the edge.

#### Scenario: An API request is proxied directly

- **WHEN** a request uses an API-owned prefix
- **THEN** Caddy reverse-proxies it directly to `api:3001`
- **AND** it does not fall through to the Web catch-all

#### Scenario: Public metrics remain unavailable

- **WHEN** a client requests `/metrics` or `/metrics/*`
- **THEN** Caddy returns `404`
- **AND** the request is not proxied to the API or Web service

### Requirement: Production responses carry the security-header floor

The production `header` block MUST set the configured security headers,
including strict transport security, content-type sniffing protection, frame
protection, referrer policy, and the enforcing content-security policy. Required
environment variables for the site address and CSP reporting URI MUST be
explicitly supplied by the production environment.

#### Scenario: A production page response is inspected

- **WHEN** a client requests a page through the production Caddy site
- **THEN** the response includes the configured security-header floor
- **AND** the response does not expose the server identity header
