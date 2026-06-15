# driver-env-feedback Specification

## Purpose

TBD - created by archiving change driver-env-feedback-stage. Update Purpose after archive.

## Requirements

### Requirement: Post-run environment sweep correlated with the drive timeline

After the drive phases of an ai-ui-driver run, the run MUST sweep the four
environment channels (Playwright-MCP console logs on disk, the driver API
structured log, Bugsink, Loki) for the run's time window and correlate hits
to driven routes via per-route timestamps recorded during the drive.

#### Scenario: Server-side error during a drive reaches the report

- **GIVEN** a driver run whose timeline records route enter/exit timestamps
- **WHEN** the API writes a `"level":"error"` line to
  `apps/api/.logs/driver/app.log` while a route is being driven
- **THEN** the per-role report's "Environment feedback" section lists the
  hit with its channel, timestamp, and the matched route, and the hit
  enters Phase 3 verify as a candidate with `kind: "env"`

### Requirement: Channel liveness — blind is never clean

Each environment channel MUST carry a liveness check; a channel that is
unreachable or has no shipped streams MUST be reported as "blind", and its
empty result MUST NOT be presented as a clean finding.

#### Scenario: Bugsink down during collection

- **GIVEN** the Bugsink container is stopped
- **WHEN** the post-run collector sweeps the channels
- **THEN** the Bugsink channel is reported "blind" in the report, not
  "no errors found"
