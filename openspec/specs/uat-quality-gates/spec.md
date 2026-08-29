# uat-quality-gates Specification

## Purpose

Define WeeklyReport release readiness through deterministic product gates,
accessible product behavior, and honest CI infrastructure evidence.

## Requirements

### Requirement: Final Acceptance Gate MUST Pass As A Bounded Product Chain

Before WeeklyReport is described as release-ready, the repository MUST pass
`pnpm typecheck`, `pnpm lint`, `pnpm test`, an explicitly configured production
`pnpm build`, and focused product-adjacent tests required by the changed release
surface. It MUST NOT require a root browser, E2E, UAT, catalog, acceptance, or
integration harness.

#### Scenario: The complete final gate is green

- **WHEN** the required product commands run at one exact Git SHA
- **THEN** every selected command exits zero
- **AND** no deleted harness command is part of the gate

#### Scenario: A final gate command fails

- **WHEN** a required product command fails
- **THEN** final acceptance fails without adding an unrelated test platform

### Requirement: Final acceptance MUST NOT depend on exhaustive runtime campaigns

The final WeeklyReport verdict MUST NOT require a browser harness, route matrix,
scenario catalog, UAT inventory, interaction graph, campaign manifest,
continuation chunks, custom supervisor, custom acceptance receipt, AI-import
verdict, or multi-hour canary.

#### Scenario: Bounded acceptance is complete

- **WHEN** deterministic code gates and relevant product-adjacent tests pass at
  one source SHA
- **THEN** acceptance is complete without any retired browser or campaign
  command

### Requirement: Code Quality Gates MUST Pass Before Deployment

All code-quality gates MUST pass (ESLint, Prettier, TypeScript strict, full test
suite) on the deployment branch before any release.

#### Scenario: Pre-deployment gate check

- **WHEN** the deployment pipeline runs pre-deployment checks
- **THEN** `pnpm typecheck`, `pnpm lint`, and `pnpm test` all exit 0
- **AND** no new ESLint warnings are introduced

### Requirement: Confirmation dialogs MUST be located by their accessibility contract

The report submission confirmation MUST expose role `alertdialog` with
accessible name `Confirm submission`. Product-adjacent UI tests MUST locate the
confirmation surface by its semantic role and accessible name.

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

### Requirement: Compact browser acceptance is one-off and source-bound

Final UI acceptance of the `apps/web` product surface MUST use a disposable,
one-off browser invocation against the exact candidate SHA and MUST cover the
lead, head, viewer, and admin journeys at representative desktop, phone,
tablet, and landscape viewports. It MUST record console errors, failed
requests, root and required nested overflow, touch geometry, dialog focus
return, and PDF delivery. The browser helper and raw session output MUST NOT
become a tracked harness.

#### Scenario: Candidate UI is accepted

- **WHEN** the one-off browser pass exercises all required roles and viewports
  against the candidate SHA
- **THEN** every asserted journey has source identity and objective evidence
- **AND** no unexpected console error, failed request, overflow, undersized
  scoped control, focus defect, or blank PDF tab remains

#### Scenario: Source changes after capture

- **WHEN** product or acceptance-relevant source changes after browser evidence
  is captured
- **THEN** the prior capture cannot establish final UI acceptance and the
  bounded pass is repeated

### Requirement: Final evidence converges on one SHA

Format, lint, typecheck, unit tests, required integration tests, coverage,
build, strict OpenSpec validation, one-off browser acceptance, independent
read-only review, remote `main`, and CI MUST all identify the same commit for
the `apps/web` and `apps/api` release surface.

#### Scenario: A gate passed on an earlier tree

- **WHEN** any required gate or review names a different source SHA than the
  candidate
- **THEN** final acceptance remains incomplete until that evidence is
  regenerated on the candidate
