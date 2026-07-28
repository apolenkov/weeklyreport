# exemplary-finding-adjudication Specification

## Purpose

TBD - created by archiving change adjudicate-exemplary-findings. Update Purpose after archive.

## Requirements

### Requirement: Unadjudicated findings are not actionable

The campaign SHALL require a source-grounded adjudication before a per-file
flag may be implemented or counted as confirmed debt.

#### Scenario: A flag has a concrete source claim

- **WHEN** the current source proves or disproves the recorded claim
- **THEN** the roadmap stores `confirmed` or `overturned`
- **AND** stores concise evidence for that verdict

#### Scenario: A flag has no claim

- **WHEN** a roadmap record contains no finding
- **THEN** it is marked `overturned`
- **AND** no defect is inferred from its `needs_work` label

### Requirement: Confirmed fixes land in verifiable slices

The campaign SHALL separate local corrections from contract migrations and
cross-feature refactors.

#### Scenario: A local correction has no product-contract impact

- **WHEN** the fix is isolated to a test, helper, or deterministic seed result
- **THEN** it may land with targeted tests and typecheck

#### Scenario: A fix changes a shared or product contract

- **WHEN** the fix changes wire schemas, persisted semantics, or UI state flow
- **THEN** it is implemented in a separate slice with direct regression tests
