## MODIFIED Requirements

### Requirement: Production API-owned paths route directly to the API

The `@api` matcher in the production Caddyfile (`deploy/helm/weeklyreport/files/Caddyfile`,
the single file mounted by both `docker-compose.prod.yml` and the Helm chart) MUST route the API-owned
prefixes (`/api/web-vitals`, `/api/client-logs`, `/trpc`, `/auth`, `/health`,
`/admin/queues`, and `/pdfs`, including their nested paths) directly to
`api:3001`. The matcher MUST NOT claim frontend-owned Next.js routes. The
public `/metrics` path MUST remain unavailable at the edge. The forwarded
`X-Forwarded-For` MUST be the single resolved client address: the peer address
when no trusted proxy is configured, otherwise the address obtained by skipping
the configured trusted proxies from the right.

#### Scenario: An API request is proxied directly

- **WHEN** a request uses an API-owned prefix
- **THEN** Caddy reverse-proxies it directly to `api:3001`
- **AND** it does not fall through to the Web catch-all

#### Scenario: Public metrics remain unavailable

- **WHEN** a client requests `/metrics` or `/metrics/*`
- **THEN** Caddy returns `404`
- **AND** the request is not proxied to the API or Web service

#### Scenario: Forwarded client address

- **WHEN** a request reaches Caddy directly from a client with no trusted proxy configured
- **THEN** the api receives that client's address as its only `X-Forwarded-For` entry

#### Scenario: Caddyfile has one location

- **WHEN** the compose mount path and the chart's `.Files` source are compared
- **THEN** they name the same file and no second copy exists
