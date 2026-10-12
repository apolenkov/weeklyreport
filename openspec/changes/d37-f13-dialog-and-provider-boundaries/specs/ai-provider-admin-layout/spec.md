## MODIFIED Requirements

### Requirement: AI Provider administration presents an explicit lifecycle workflow

The Admin `AI → Provider` surface MUST present a summary of the current
availability/revision state before the configuration controls and MUST expose
the existing lifecycle as visible ordered steps: `Configure`, `Test
capabilities`, and `Activate`. The steps MUST derive eligibility from existing
API state; an unavailable step MUST remain visible, disabled, and accompanied
by an actionable reason. The surface MUST show loading, async test progress,
preparation progress, and operation errors in accessible regions without
inventing a new lifecycle state or changing server semantics.

#### Scenario: Administrator scans an active provider

- **WHEN** an administrator opens `/admin?tab=ai` with an active revision
- **THEN** the first card identifies that AI is active and presents
  `Edit configuration` as the primary configuration action
- **AND** the Configure, Test capabilities, and Activate steps remain visible
  with Activate unavailable unless a new tested draft is selected
- **AND** Disable remains available through the existing active-service action

#### Scenario: Administrator continues an unconfigured or draft setup

- **WHEN** no active revision exists or the selected revision is `draft` or
  `failed`
- **THEN** the editable configuration form is initially available
- **AND** the summary states what is missing or failed and the next action
  explains why later steps are disabled

#### Scenario: Administrator observes asynchronous work

- **WHEN** a provider test is queued/running or an activation is preparing
- **THEN** the UI identifies the operation state and disables duplicate or
  conflicting actions
- **AND** test lanes or preparation completed/total/failed/elapsed values are
  shown from the existing read model
- **AND** a recoverable error includes an actionable next step without exposing
  provider response bodies or credentials

#### Scenario: Persisted test blocks activation

- **WHEN** the selected validated revision has a latest queued or running test
- **THEN** Activate remains visible but disabled with a wait reason and its workflow step does not claim availability

### Requirement: Provider diagnostics remain available as secondary detail

The existing Diagnostics disclosure MUST remain closed by default and retain
revision metadata, capability results, preparation details, masked credential
metadata, and eligible Restore/Discard actions. The primary summary and
lifecycle cards MUST expose the next action without requiring Diagnostics to be
opened, and opening Diagnostics MUST NOT change provider lifecycle state.

#### Scenario: Administrator opens diagnostics after scanning the workflow

- **WHEN** the administrator opens the native `Diagnostics` disclosure
- **THEN** the retained diagnostic values and eligible revision actions are
  available without changing the active pointer or configuration state

#### Scenario: Direct Provider keeps the first viewport focused

- **WHEN** an administrator views a Provider revision with capability results
  or retained revisions
- **THEN** the capability status strip and any current progress, feedback, or
  error message remain visible in the primary flow
- **AND** revision metadata and retained-revision content are not expanded by
  default

#### Scenario: Administrator opens Provider diagnostics

- **WHEN** the administrator activates the `Diagnostics` disclosure
- **THEN** the revision metadata, masked credentials, capability-lane results,
  embedding measurement, and any Restore or Discard action become available
- **AND** opening diagnostics does not change provider lifecycle state or the
  active configuration

#### Scenario: Unmeasured embeddings are explicit

- **WHEN** a revision has null embedding dimensions
- **THEN** both diagnostic and retained measurement displays say "not measured" while numeric measurements retain their value
