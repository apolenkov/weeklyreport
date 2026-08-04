## ADDED Requirements

### Requirement: PDF worker completion is an executed integration contract

`e2e/integration/pdf-export.integration.spec.ts` MUST execute the real enqueue, worker, persistence, and artifact-read path without fixme/skip markers or a `networkidle` dependency.

#### Scenario: Worker completes and persists an artifact

- **WHEN** an authorized user enqueues a PDF export in the integration environment
- **THEN** the test observes terminal ready status, a persisted artifact URL owned by the request, and a readable non-empty PDF artifact

#### Scenario: Browser devtools keep a connection open

- **WHEN** unrelated browser connections remain open during the export
- **THEN** completion waits on the job and render-ready contracts rather than global network idle

#### Scenario: Worker or render fails

- **WHEN** the render outcome or worker reaches terminal failure
- **THEN** no success artifact is persisted and the integration assertion fails with the terminal reason
