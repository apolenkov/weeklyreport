# sdlc-release-readiness Specification

## Purpose

Defines the evidence boundary for every WeeklyReport lifecycle stage and the
controls that must be real, verified, and reproducible before the first
production point.

## Requirements

### Requirement: SDLC status MUST separate evidence classes

The durable SDLC record MUST distinguish repository-declared controls, locally
executed evidence, live externally verified settings, and unverified or
unavailable controls. It MUST NOT present a checked-in pipeline as proof that a
platform rule, deployment environment, release, backup target, or alert receiver
is active.

#### Scenario: An administrative API returns forbidden

- **WHEN** a settings probe returns `403` because of token scope or plan limits
- **THEN** the control is recorded as unverified
- **AND** it is not classified as enabled or disabled solely from that response

### Requirement: Every lifecycle stage MUST have a durable acceptance boundary

The project documentation MUST define acceptance evidence for planning, build,
verification, security, release, deployment, operation, recovery, and learning.
Each boundary MUST name the current control or the prerequisite that remains.

#### Scenario: A maintainer reviews release readiness

- **WHEN** the maintainer reads the SDLC record without session history
- **THEN** they can identify what is enforced now, what blocks production, and
  what evidence closes each block

### Requirement: The first production point MUST fail closed

Before production data or traffic exists, the project MUST have a protected
`main` merge gate with required stable checks, verified security scanning,
build-once artifact identity with SBOM and signed provenance, protected
promotion environments, independently stored and restore-tested backups with
measured RPO/RTO, owned SLO and alert paths, and an immutable release record.

#### Scenario: A production prerequisite has no evidence

- **WHEN** any required control is absent, unverified, or represented only by a
  placeholder workflow or document
- **THEN** the first production point remains blocked
- **AND** the project MUST NOT claim production readiness

### Requirement: Pre-production documentation MUST NOT fabricate delivery

While no registry, deployment target, environment owner, or production secret
boundary exists, the repository MUST document the required promotion design but
MUST NOT add a workflow that appears deployable while it cannot publish,
promote, verify, or roll back a real immutable artifact.

#### Scenario: No production target exists

- **WHEN** release-readiness work is performed before a production target is
  configured
- **THEN** repository-local hardening and evidence contracts may be completed
- **AND** external deployment tasks remain explicit first-production blockers
