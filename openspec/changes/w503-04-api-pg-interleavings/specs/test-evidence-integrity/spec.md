## ADDED Requirements

### Requirement: The API unit contour cannot reach a real Redis

The API unit test contour MUST provide a Redis host that cannot resolve, so a
real Redis client built from the unit defaults fails before any command
reaches a server, whatever Redis the developer or CI environment exposes. The
coverage contour, which runs the integration suites against the guarded Redis
target, MUST keep its own target.

#### Scenario: A unit test builds a real client from the defaults

- **WHEN** a unit test constructs a Redis client from the unit environment
- **THEN** the host does not resolve and the first command fails without a
  server connection

#### Scenario: The developer exports a real Redis host

- **WHEN** the shell running the unit contour exports `REDIS_HOST`
- **THEN** the unit contour still uses the unresolvable host
