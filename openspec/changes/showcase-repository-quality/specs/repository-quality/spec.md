## ADDED Requirements

### Requirement: GitHub Actions runs the repository quality gates

CI SHALL preserve the existing format, lint, typecheck, and test checks.
Independent jobs SHALL enforce the configured API and web coverage thresholds,
upload the coverage reports, validate OpenSpec, scan the checked-out tree and
reachable Git history for secrets, and audit dependencies.
The history scan SHALL traverse all parents and include each merge's diff
against its first parent.

#### Scenario: CI verifies a pull request

- **WHEN** CI runs for a pull request or a push to main
- **THEN** checks, coverage, and supply-chain jobs run independently
- **AND** a coverage threshold failure or a supply-chain finding fails its job
- **AND** the coverage job requires all four reports listed for upload to be nonempty

### Requirement: GitHub Actions runs security analysis

The repository SHALL run CodeQL for JavaScript and TypeScript with the
security-and-quality suite and SHALL publish OpenSSF Scorecard results.
External actions SHALL be pinned by full commit SHA with a version comment.
The workflows SHALL grant write permissions only to jobs that publish results.

#### Scenario: GitHub starts the scheduled scans

- **WHEN** the weekly schedules trigger
- **THEN** CodeQL analyzes the repository and Scorecard publishes the repository assessment

### Requirement: Community files describe GitHub contribution and disclosure

The repository SHALL provide a default code owner, issue and pull request
templates, and a security policy. The issue chooser and security policy SHALL
direct vulnerability reports to GitHub private vulnerability reporting.

#### Scenario: A contributor opens the issue chooser

- **WHEN** a contributor visits the issue chooser
- **THEN** they can use a bug or feature template or follow the private security reporting link
- **AND** `GET /repos/apolenkov/weeklyreport/private-vulnerability-reporting`
  returns `enabled: true`

### Requirement: The Russian README reflects the repository

The README SHALL retain the hero and existing quick-start commands, describe
the package boundaries, and show where the quality checks are configured to run.
It SHALL link the contribution, security, documentation, and license files.

#### Scenario: A reader checks coverage and setup

- **WHEN** a reader uses the README to find the coverage floors and local setup
- **THEN** the floors match the Vitest configuration and the quick-start block is preserved

### Requirement: Repository images have traceable sources

The README SHALL link an architecture diagram, a quality-gate diagram, and at
least two images from actual CLI output. Each new image SHALL have descriptive
alt text and a caption with the producing command. Each PNG SHALL be smaller
than 500 KB.

#### Scenario: A reader inspects the diagrams and CLI evidence

- **WHEN** a reader opens the README images
- **THEN** the diagrams reflect the current source and workflows
- **AND** the CLI images show captured output from commands run for this change
