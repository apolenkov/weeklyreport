## Purpose

Defines one compact, deterministic browser acceptance contour that protects WeeklyReport's critical user journeys without growing into a second orchestration platform.

## ADDED Requirements

### Requirement: WeeklyReport MUST have one owned browser acceptance contour

The repository MUST expose one blocking `e2e/acceptance/` contour implemented with the existing Playwright runner. It MUST reuse the canonical scenario catalog, deterministic seed contracts, dev-auth helper, disposable-database guard, and integration resource helpers. It MUST NOT implement a second scenario compiler, interaction graph, continuation protocol, campaign state machine, lane orchestrator, AI report importer, or custom evidence ledger.

#### Scenario: A new acceptance journey is added

- **WHEN** a critical WeeklyReport journey needs browser acceptance coverage
- **THEN** the journey is added to `e2e/acceptance/` or an existing focused integration spec
- **AND** no parallel runner, resumable campaign, or custom orchestration layer is introduced

### Requirement: Critical product journeys MUST cover all four roles

The full acceptance command MUST exercise the lead, head, admin, and viewer roles through deterministic, machine-checkable outcomes. Coverage MUST include lead edit/autosave/submit, head review/publish/revoke/PDF, admin period/configuration/action-log behavior, viewer published read-only behavior, role authorization, and the cataloged route surface. Every state-changing journey MUST assert both the visible result and the persisted or API read-back when applicable.

#### Scenario: Full product acceptance runs

- **WHEN** `pnpm test:acceptance` runs against the exact disposable WeeklyReport database
- **THEN** every critical four-role journey completes with its visible and data outcomes proven
- **AND** every cataloged role-reachable route is visited without an unclassified page, console, network, accessibility, or HTTP failure

### Requirement: Acceptance complexity and duration MUST be bounded

The owned acceptance implementation MUST contain at most 50 source files and at most 8,000 non-generated lines. On the reference Mac, `pnpm test:acceptance:smoke` MUST complete within 10 minutes, `pnpm test:acceptance` MUST complete within 30 minutes, and teardown MUST complete within 2 minutes. The gate MUST fail when a measured budget is exceeded; raising a budget requires an explicit spec change with a measured product-coverage justification.

#### Scenario: Acceptance exceeds a budget

- **WHEN** the measured file count, line count, smoke duration, full duration, or teardown duration exceeds its bound
- **THEN** the acceptance gate fails and names the exceeded budget
- **AND** the overage cannot be hidden by excluding owned files or omitting failed timing receipts

### Requirement: Standard Playwright evidence MUST be sufficient

Acceptance MUST use Playwright's standard list/HTML/JSON or JUnit reporting and built-in trace, screenshot, and video artifacts on failure. A release run MUST record the Git SHA, command, exit status, browser version, duration, scenario totals, and cleanup result. Passing runs MUST NOT generate per-action immutable assets, hash chains, continuation receipts, or AI-authored verdicts.

#### Scenario: A journey fails

- **WHEN** an acceptance journey fails
- **THEN** the standard Playwright report identifies the scenario and failure
- **AND** its failure trace, screenshot, relevant logs, exact Git SHA, and cleanup result are retained without a custom evidence protocol

### Requirement: Disposable state and cleanup MUST fail closed

All destructive setup and teardown MUST target only the exact guarded loopback WeeklyReport E2E database, carry per-run consent immediately before the destructive primitive, and use uniquely owned local resources. Cleanup MUST run after pass, failure, timeout, or interruption and MUST prove that owned processes, containers, volumes, and listeners are absent before reporting terminal success.

#### Scenario: Acceptance is interrupted

- **WHEN** the runner receives a termination signal or a scenario times out
- **THEN** the bounded teardown removes only resources owned by that run
- **AND** a missing or failed cleanup proof makes the overall result `FAIL_NOT_PROVEN`

### Requirement: Acceptance MUST be rerunnable from the beginning

Each acceptance run MUST start from deterministic seed state and MUST be independently rerunnable from the beginning. No run MAY resume a partial interaction graph or reuse a prior run's browser state, database state, checkpoint, or acceptance verdict.

#### Scenario: A prior run failed halfway

- **WHEN** a maintainer starts the next acceptance run
- **THEN** the next run creates fresh owned resources and deterministic state
- **AND** it neither resumes nor promotes any partial evidence from the failed run
