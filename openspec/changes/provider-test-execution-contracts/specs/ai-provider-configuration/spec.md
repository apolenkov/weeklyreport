## ADDED Requirements

### Requirement: A provider test request audits an enqueue only when it enqueued

`AiProviderDraftService.test` MUST record `ai_provider.test_queued` only for a request that
enqueued the provider test execution (a created execution or a queued one). A request that does not
enqueue MUST NOT record `ai_provider.test_queued` and MUST return the revision with its current
execution state. Re-enqueueing an execution that is already `running`, and recovery of an execution
whose job is gone, remain open for the C0890 Root decision.

#### Scenario: already running execution

- **WHEN** an administrator requests a provider test and the reusable execution is `running`
- **THEN** the returned revision shows the current execution state
- **AND** `ai_provider.test_queued` is recorded only if the request enqueued the execution

### Requirement: Retry identity collisions never cross suite versions

When creating a provider test execution loses a unique-identity race, the caller MUST be
attached to the existing row only if that row has the requested `testSuiteVersion`; otherwise the
original error MUST propagate.

#### Scenario: collision with another suite version

- **WHEN** the unique identity is taken by an execution of a different `testSuiteVersion`
- **THEN** the request fails with the original error instead of reusing that execution
