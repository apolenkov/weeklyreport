## ADDED Requirements

### Requirement: Prod-layered observability MUST target the running prod services

Every exporter and scrape target in the observability overlay MUST resolve against the actual prod service names, ports, and database names.
This applies when `docker-compose.observability.yml` is layered on top of
the prod compose file — no target may resolve to a hardcoded dev-only
value.

#### Scenario: Postgres exporter targets the prod database name

- **WHEN** `docker-compose.observability.yml` is composed with
  `docker-compose.prod.yml`
- **THEN** `postgres-exporter`'s `DATA_SOURCE_NAME` resolves to the same
  database name `docker-compose.prod.yml` configures for `POSTGRES_DB`
- **AND** it does not hardcode `customreport_dev`

#### Scenario: Prometheus scrapes the API's prod-reachable metrics port

- **WHEN** `docker-compose.observability.yml` is composed with
  `docker-compose.prod.yml`
- **THEN** at least one Prometheus scrape target in
  `deploy/prometheus-otel-lgtm.yml` resolves to the API container's
  compose-network address and prod port (`api:3001`)
- **AND** the API `/metrics` endpoint is reachable from that target without
  relying on the dev-only host-published port

### Requirement: Observability admin credentials MUST NOT silently default

`docker-compose.observability.yml` MUST require `GRAFANA_ADMIN_PASSWORD` to
be set explicitly and MUST NOT fall back to a hardcoded or well-known
default when the variable is absent.

#### Scenario: Grafana boots without GRAFANA_ADMIN_PASSWORD set

- **WHEN** the observability overlay is composed without
  `GRAFANA_ADMIN_PASSWORD` set in the environment
- **THEN** compose fails loud (required-variable error) rather than booting
  Grafana with an `admin`/`admin` login

### Requirement: Non-prod container images MUST be pinned to an immutable digest

Every image reference in `docker-compose.yml`, `docker-compose.errors.yml`, and `docker-compose.observability.yml` that currently resolves to a mutable tag MUST be pinned to a `@sha256:...` digest.
This applies to any `:latest` or bare version tag without a digest, matching
the pinning discipline `docker-compose.prod.yml` already applies to
`postgres`, `pgbouncer`, `redis`, and `caddy`.

#### Scenario: A dev/observability image is referenced by tag only

- **WHEN** an image reference in `docker-compose.yml`,
  `docker-compose.errors.yml`, or `docker-compose.observability.yml` has no
  `@sha256:...` suffix
- **THEN** the reference is updated to include the digest of the image
  currently in use
- **AND** the human-readable tag is preserved for reference (e.g. as a
  trailing comment or in the same `image:` line before the digest)

### Requirement: GitHub Actions steps MUST be pinned to a commit SHA

Every `uses:` step in `.github/workflows/ci.yml` referencing a mutable major-version tag (e.g. `actions/checkout@v4`) MUST be pinned to a full commit SHA.
The SHA MUST be the commit the tag currently resolves to, with the
human-readable tag preserved as a trailing comment.

#### Scenario: A workflow step references a mutable action tag

- **WHEN** a `uses:` line in `ci.yml` references `owner/action@vN`
- **THEN** it is rewritten to `owner/action@<40-char-sha>  # vN`
- **AND** the SHA is the commit the `vN` tag pointed to at pin time

### Requirement: Observability host ports MUST bind to loopback in a prod-layered run

Every host port `docker-compose.observability.yml` publishes MUST bind to
`127.0.0.1` rather than all interfaces, so a prod-layered observability run
does not expose Grafana, the OTLP receiver, or the Prometheus UI to the
public network.

#### Scenario: The observability overlay is composed over the prod stack

- **WHEN** `docker-compose.observability.yml` is layered on
  `docker-compose.prod.yml` and brought up on a host with a public network
  interface
- **THEN** the Grafana (`GRAFANA_PORT`), OTLP gRPC (`4317`), OTLP HTTP
  (`4318`), and Prometheus (`9090`) ports published by `otel-lgtm` are only
  reachable from `127.0.0.1` on that host
- **AND** none of those ports are reachable from the public network
  interface

### Requirement: A monitoring webhook target MUST resolve to a real, reachable route

`deploy/alertmanager.yml`'s webhook configuration MUST target a port the
production API container actually exposes on the compose network. If the
receiving route does not yet exist in the API, the file MUST say so
explicitly in a comment rather than pointing at a plausible-looking but
non-existent path silently.

#### Scenario: The webhook target port doesn't match the API's actual port

- **WHEN** `deploy/alertmanager.yml`'s webhook URL host:port doesn't match
  the API container's `PORT`/`expose` configuration in
  `docker-compose.prod.yml`
- **THEN** the webhook URL is corrected to the actual port

#### Scenario: The webhook target endpoint has no receiving route

- **WHEN** the API has no route handler for the webhook's configured path
- **THEN** the file's comment explicitly states the endpoint is not yet
  implemented and alerting MUST NOT be activated until it is
- **AND** the URL is not silently left pointing at a non-existent endpoint
  without that comment
