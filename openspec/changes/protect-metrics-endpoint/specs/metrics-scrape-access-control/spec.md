## ADDED Requirements

### Requirement: Metrics endpoint blocked at the public Caddy edge

The `/metrics` path SHALL NOT appear in the Caddy `@api` path matcher in any
production or staging Caddyfile; Caddy MUST respond with a non-2xx HTTP status
for any request to `/metrics` arriving at the public domain.

#### Scenario: Anonymous GET /metrics via public domain returns non-2xx

- **GIVEN** Caddy is configured with `/metrics` removed from the `@api` matcher
- **WHEN** an unauthenticated HTTP client sends `GET https://{CADDY_SITE_ADDRESS}/metrics`
- **THEN** the response status is not in the 2xx range (Caddy's default handler returns 404 via Next.js or equivalent)
- **AND** the response body does NOT contain Prometheus text-format content (no `# HELP` or `# TYPE` lines)

#### Scenario: Caddyfile path list does not include /metrics

- **GIVEN** `deploy/caddy/Caddyfile` and `deploy/caddy/Caddyfile.staging` are reviewed
- **WHEN** the `@api` matcher block is inspected
- **THEN** the string `/metrics` is absent from the `path` directive in both files

### Requirement: Authorized scrapers retain an internal network path to /metrics

Prometheus scrape jobs and other authorized monitoring agents MUST be able to
reach `GET /metrics` via a network path that bypasses the public Caddy edge
(direct access to the API container or Docker-host-mapped port).

#### Scenario: Prometheus scrape succeeds via internal Docker host port (local/dev)

- **GIVEN** the api container is running with its internal port mapped to the Docker host
- **WHEN** the Prometheus job `customreport-api` scrapes `host.docker.internal:{API_PORT}/metrics`
- **THEN** the response is HTTP 200
- **AND** the `Content-Type` header begins with `text/plain; version=0.0.4`
- **AND** `# HELP cr_` or `# TYPE cr_` metric families appear in the body

#### Scenario: Production managed scraper targets internal network, not public domain

- **GIVEN** the production Prometheus (or managed observability stack) is configured
- **WHEN** the scrape target for `customreport-api` is inspected
- **THEN** the target URL does NOT use `{CADDY_SITE_ADDRESS}` (the public domain)
- **AND** the target URL reaches `api:3001` via the internal Docker network or a host-port mapping

### Requirement: Production API host port does not expose /metrics publicly

The production API container port MUST NOT be reachable on the host's public
network interface; `docker-compose.prod.yml` SHALL NOT publish the API port on
`0.0.0.0`, so that removing `/metrics` from Caddy cannot be bypassed by a direct
request to the host-mapped port. This requirement is prod-scoped and does not
affect the local/dev host-port scrape path.

#### Scenario: Prod compose does not publish the API port on all interfaces

- **GIVEN** `docker-compose.prod.yml` is reviewed
- **WHEN** the `api` service network configuration is inspected
- **THEN** the API container port is exposed only to the internal Docker network (`expose`), OR any host `ports` mapping is bound to `127.0.0.1`
- **AND** there is NO `0.0.0.0` host publish of the API port (no bare `"${API_PORT:-3001}:3001"` mapping)

#### Scenario: Direct host request to /metrics is not publicly reachable in prod

- **GIVEN** the prod stack is deployed with the API port not published on the public interface
- **WHEN** an external client sends `GET http://<prod-host-public-ip>:{API_PORT}/metrics`
- **THEN** the connection does not return Prometheus text-format content (refused, filtered, or unreachable)
- **AND** the only authorized path to `/metrics` is the internal Docker network or a loopback-bound host port plus firewall rule
