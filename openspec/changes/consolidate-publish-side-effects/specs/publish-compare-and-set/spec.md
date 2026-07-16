## ADDED Requirements

### Requirement: Post-publish side-effects are emitted from one module

Post-publish side-effects (the telemetry pair, the ingestion enqueue, the analytics-cache invalidation) MUST be emitted through one shared module in the period application layer, with one shared `IngestionPublishHook` type; publish-capable services MUST NOT carry a private copy of the emission discipline, and side-effects MUST fire only after a real state transition (never on raced, archived, or skipped outcomes).

#### Scenario: Manual and auto publish share the emission seam

- **WHEN** a head publishes via `period.publish` or the scheduler auto-publishes a candidate
- **THEN** both paths emit telemetry and enqueue ingestion through the same module
- **AND** a redundant or raced publish emits nothing

#### Scenario: Ingestion degradation never breaks publish

- **WHEN** the ingestion hook rejects during side-effect emission
- **THEN** the publish still succeeds and telemetry is unaffected

### Requirement: There is exactly one manual publish entry point

The tRPC surface MUST expose exactly one manual publish mutation (`period.publish`); the system MUST NOT keep a second head-facing publish procedure without a product consumer.

#### Scenario: A head publishes from any surface

- **WHEN** any head UI surface triggers publishing
- **THEN** the request goes through `period.publish`
- **AND** no `review.publish` procedure exists on the router
