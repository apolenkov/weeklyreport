## MODIFIED Requirements

### Requirement: The renderer service is internal-only and immutably pinned

The production `gotenberg` service MUST be declared in the Helm chart with an
immutable image reference — `gotenberg/gotenberg:8.39.0-chromium` pinned by
the multi-platform manifest-list sha256 digest — MUST NOT publish a host
port or a public ingress route, and MUST be reachable only by the API over
the internal network. The API MUST locate it through validated fail-closed
configuration (`GOTENBERG_URL`, no default) rather than a hardcoded
address.

#### Scenario: No external surface exists

- **WHEN** the rendered production Helm resources are inspected
- **THEN** the renderer has only an internal ClusterIP Service, no host port or host networking, and no ingress route
- **AND** the API reaches it only through `GOTENBERG_URL` on the internal
  network

#### Scenario: Missing renderer configuration fails boot

- **WHEN** `GOTENBERG_URL` is absent or malformed
- **THEN** API boot validation fails before the service accepts traffic
