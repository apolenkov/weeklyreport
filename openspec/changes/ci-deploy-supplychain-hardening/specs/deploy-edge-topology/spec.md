## ADDED Requirements

### Requirement: The API image declared port matches its runtime port

`Dockerfile.api` SHALL `EXPOSE` and run its baked `HEALTHCHECK` against the same
port the API binds at runtime (`3001`), so a plain `docker run` or a
baked-healthcheck orchestrator does not report the container permanently
unhealthy. The `EXPOSE` and `HEALTHCHECK` MUST either both use `3001` or both be
parameterized via the `PORT` environment variable using the same default the
application reads, rather than the current hardcoded `3002`.

#### Scenario: Standalone container reports healthy

- **GIVEN** the API image built from the updated `Dockerfile.api`
- **WHEN** the image is run standalone (no compose healthcheck override) and the
  API has started
- **THEN** the baked `HEALTHCHECK` probes the port the API actually binds and
  reports the container healthy

#### Scenario: No residual 3002 mismatch

- **GIVEN** the updated `Dockerfile.api`
- **WHEN** the `EXPOSE` and `HEALTHCHECK` lines are inspected
- **THEN** they reference `3001` (or `PORT` with the runtime default), and do
  not hardcode `3002` while the API binds `3001`

### Requirement: The API is reachable only through the Caddy edge

The `api` service in `docker-compose.prod.yml` SHALL be expose-only (or bound to
localhost), not host-published, so all external traffic flows through the Caddy
edge and its TLS/header controls, matching the expose-only posture already
applied to the `web` service. The host-publishing
`ports: ["${API_PORT:-3001}:3001"]` MUST be replaced with `expose: ["3001"]`
(or a `127.0.0.1`-bound publish) unless direct host access is an intentional,
documented ops need.

#### Scenario: API has no public host port in prod compose

- **GIVEN** the updated `docker-compose.prod.yml`
- **WHEN** the `api` service networking is inspected
- **THEN** it declares `expose: ["3001"]` (or a localhost-only bind) and no
  `0.0.0.0` host-published `ports:` entry, while Caddy still reverse-proxies to
  `api:3001` over the compose network

#### Scenario: A remote caller cannot bypass the edge (expose-only)

- **GIVEN** the API running under the updated prod compose with `expose: ["3001"]`
- **WHEN** any caller attempts to reach the API directly on a host interface
  outside the Caddy hop
- **THEN** no host port is published at all, so the API socket is unreachable
  from the host and from any remote machine, and the edge TLS and header
  controls cannot be bypassed

#### Scenario: A remote caller cannot bypass the edge (localhost-bound option)

- **GIVEN** the API running under the updated prod compose with a
  `127.0.0.1`-bound publish, chosen for a documented ops need
- **WHEN** a remote caller on another machine attempts to reach the API directly
  on a host interface outside the Caddy hop
- **THEN** the published port is bound only to loopback, so it is unreachable
  from any non-loopback interface and the edge controls cannot be bypassed from
  another machine — host-local processes can still reach loopback, which is the
  accepted trade-off of this option versus `expose:`

#### Scenario: Trust-proxy prerequisite is satisfied

- **GIVEN** the `set-express-trust-proxy` change requires the API host port
  closed before enabling `trust proxy` in production (its `BL-DEPLOY-SEAM-MISC`
  prerequisite)
- **WHEN** this change makes the `api` service expose-only
- **THEN** the prerequisite is satisfied: an attacker can no longer reach the
  Express socket outside the Caddy hop to forge `X-Forwarded-For`
