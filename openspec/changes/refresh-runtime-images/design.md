## Context

The repository pins image digests, but several digests trail their supported
release lines and three overlays retain `latest` as the human-readable tag. The
MVP owns no persistent production data and is recreated from the current schema
and deterministic seeds.

## Goals / Non-Goals

**Goals:**

- Make every external runtime release explicit and immutable.
- Preserve current service APIs, health checks, routing, and recovery commands.
- Validate stateful changes only against disposable volumes.

**Non-Goals:**

- Preserve old local volumes or historical extension versions.
- Adopt prerelease framework or ORM majors.
- Add a deployment orchestrator or release-history layer.

## Decisions

- Keep PostgreSQL and Redis on their current supported major lines while taking
  the latest reviewed patch releases.
- Recreate disposable PostgreSQL state so pgvector is installed directly at the
  current extension version instead of carrying an upgrade-only migration.
- Use explicit versions for development and observability overlays as well as
  production services.
- Treat configuration rendering as necessary but insufficient: validate the
  pooler query path, edge policy, telemetry and mail readiness, metrics, and
  error-tracker startup and persistence where an image changes those contracts.

## Risks / Trade-offs

Pulling the complete observability image is expensive and its upstream scope is
development/demo. A failed compatibility check blocks that update rather than
weakening mounts or health contracts. PgBouncer and Caddy changes are accepted
only with their current configuration validated by the target binaries.
