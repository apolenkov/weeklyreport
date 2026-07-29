## ADDED Requirements

### Requirement: Browser business assertions MUST survive unrelated seed growth

An integration test that verifies a business transition MUST derive its
precondition from the canonical seed manifest or the live seeded database and
assert the transition relative to that precondition. It MUST NOT encode an
absolute count whose value changes when an unrelated user, product, or report
fixture is added.

#### Scenario: An unrelated full-profile entity is added

- **WHEN** the canonical `full` seed adds a product, user, or section outside a
  journey's business subject
- **THEN** the journey continues to pass without updating an unrelated absolute
  count
- **AND** the transition's exact before/after delta remains asserted

#### Scenario: A mutation changes one submission

- **WHEN** a revoke or submit journey changes exactly one report section
- **THEN** the test reads the relevant count before the action
- **AND** asserts that the count changes by exactly one in the required direction

### Requirement: Confirmation dialogs MUST be located by their accessibility contract

Browser acceptance tests MUST locate a confirmation surface by its semantic
role and accessible name. The report submission confirmation SHALL expose role
`alertdialog` with accessible name `Confirm submission`.

#### Scenario: A lead initiates report submission

- **WHEN** the lead activates the `Submit` action
- **THEN** an `alertdialog` named `Confirm submission` is visible
- **AND** its scoped `Submit` action completes the mutation

### Requirement: Acceptance evidence MUST distinguish infrastructure rejection

Server-side acceptance evidence MUST state whether a job received a runner and
executed test steps. A workflow rejected before runner allocation MUST NOT be
reported as a repository test pass or test failure.

#### Scenario: GitHub rejects a job before assigning a runner

- **WHEN** the job has no runner and no executed steps
- **THEN** the acceptance record classifies it as an infrastructure allocation
  blocker
- **AND** preserves GitHub's exact annotation separately from local test results
