## MODIFIED Requirements

### Requirement: Post-publish side-effects are emitted from one module

Post-publish side-effects (the telemetry pair and analytics-cache invalidation) MUST be emitted through one shared module in the period application layer; publish-capable services MUST NOT carry a private copy of the emission discipline, and side-effects MUST fire only after a real state transition (never on raced, archived, or skipped outcomes). Publish-time ingestion MUST NOT be required, invoked, or represented by a no-op collaborator in the current MVP.

#### Scenario: Manual and auto publish share the emission seam

- **WHEN** a head publishes via `period.publish` or the scheduler auto-publishes a candidate
- **THEN** both paths emit telemetry and invalidate the analytics cache through the same module
- **AND** a redundant or raced publish emits nothing

#### Scenario: Post-commit side-effect degradation never breaks publish

- **WHEN** telemetry or analytics-cache invalidation fails after a successful publish transition
- **THEN** the publish still succeeds
- **AND** the failed side effect is reported without preventing the independent side effect from running

#### Scenario: Ingestion degradation never breaks publish

- **WHEN** a deferred ingestion system is unavailable or unconfigured
- **THEN** manual and automatic publishing still succeed because the current MVP does not invoke an ingestion path

#### Scenario: Production composition has no dormant ingestion dependency

- **WHEN** the API modules resolve under `NODE_ENV=production` with the required product configuration
- **THEN** manual and automatic publishing resolve without an ingestion queue, hook, no-op adapter, or missing-consumer guard
- **AND** no publish path reads report-section identifiers solely for ingestion
