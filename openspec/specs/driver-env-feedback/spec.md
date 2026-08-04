# driver-env-feedback Specification

## Purpose

Correlate post-drive environment-channel evidence with the drive timeline and report unreachable or stream-less channels as blind rather than clean.

## Requirements

### Requirement: Post-run environment sweep is a deferred collector contract

The shipped `e2e/sweep/` harness does not yet include a post-run environment
collector. When that collector is introduced, it MUST sweep the four channels
(Playwright-MCP console logs on disk, the driver API structured log, Bugsink,
Loki) for the run's time window and correlate hits to driven routes via
per-route timestamps recorded during the drive. Until then, the driver MUST
preserve its timeline and MUST NOT present an uncollected channel as clean.

#### Scenario: Server-side error during a drive reaches the report

- **GIVEN** a driver run whose timeline records route enter/exit timestamps
- **WHEN** the API writes a `"level":"error"` line to
  `apps/api/.logs/driver/app.log` while a route is being driven
- **THEN** the future collector's report lists the hit with its channel,
  timestamp, and matched route, and the hit enters the verify stage as a
  candidate with `kind: "env"`

### Requirement: Channel liveness — blind is never clean

When the collector is shipped, each environment channel MUST carry a liveness
check; a channel that is
unreachable or has no shipped streams MUST be reported as "blind", and its
empty result MUST NOT be presented as a clean finding.

#### Scenario: Bugsink down during collection

- **GIVEN** the Bugsink container is stopped
- **WHEN** the post-run collector sweeps the channels
- **THEN** the Bugsink channel is reported "blind" in the report, not
  "no errors found"
