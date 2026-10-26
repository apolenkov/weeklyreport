## ADDED Requirements

### Requirement: A provider test request audits an enqueue only when it enqueued

`AiProviderDraftService.test` MUST record `ai_provider.test_queued` only for a request that
enqueued the provider test execution (a created execution or a queued one). A request that finds the
execution already `running` MUST NOT enqueue, MUST NOT record `ai_provider.test_queued` and
MUST return the revision with its current execution state.

#### Scenario: execution already running

- **WHEN** an administrator requests a provider test and the reusable execution is `running`
- **THEN** nothing is enqueued
- **AND** no `ai_provider.test_queued` event is recorded
- **AND** the returned revision shows the current execution state

### Requirement: Retry identity collisions never cross suite versions

When creating a provider test execution loses a unique-identity race, the caller MUST be
attached to the existing row only if that row has the requested `testSuiteVersion`; otherwise the
original error MUST propagate.

#### Scenario: collision with another suite version

- **WHEN** the unique identity is taken by an execution of a different `testSuiteVersion`
- **THEN** the request fails with the original error instead of reusing that execution
