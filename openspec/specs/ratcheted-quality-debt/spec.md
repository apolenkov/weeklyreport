# ratcheted-quality-debt Specification

## Purpose

Run quality-debt work from measured inventories with independent completion, one-directional enforcement, explicit adjudication, and durable resume evidence.

## Requirements

### Requirement: The campaign uses the measured debt inventory

The repository MUST treat 27 pre-compilation `no-circular` violations grouped
into 9 connected clusters, 126 raw suppression-text matches, and 26 ESLint
`files:` blocks as the starting inventory for this campaign. Parser-backed
remeasurement MUST distinguish the 115 live ESLint directives across 93 files
from the 11 strings or explanatory mentions that created measurement noise. A
changed starting value MUST be remeasured from the current tree and reconciled
before implementation continues.

#### Scenario: A future session resumes the campaign

- **WHEN** an implementation session starts after another commit has landed
- **THEN** it re-runs the owning measurement for the surface it will edit
- **AND** reconciles any drift with the last durable checkpoint

### Requirement: Independent changes own independent completion

Type-cycle elimination, suppression adjudication, ESLint policy-scope cleanup,
and seed-profile unification MUST remain independently validatable OpenSpec
changes. The debt changes MUST execute in the order cycles, suppressions, then
policy scopes.

#### Scenario: Cycle work is interrupted

- **WHEN** one connected cycle cluster has landed but later clusters have not
- **THEN** the cycle task ledger and baseline identify the exact remaining work
- **AND** suppression or policy-scope work is not represented as completed

### Requirement: Raw count reduction MUST NOT weaken enforcement

The campaign MUST NOT reduce a count by disabling a dependency rule, widening an
ESLint exclusion, moving an inline suppression to configuration, introducing a
generic type dump or barrel indirection, or duplicating a contract.

#### Scenario: A proposed cleanup makes the metric greener

- **WHEN** the measured count falls but effective enforcement or dependency
  direction is weaker
- **THEN** the proposal is rejected
- **AND** the baseline is not updated

### Requirement: Every completed slice leaves durable resume evidence

Each implementation slice MUST checkpoint the local HTML report,
`roadmap.json`, and `HANDOFF.md` with its exact measurement transition,
verification commands and results, commit, push state, and next starting point.

#### Scenario: The session ends after a slice

- **WHEN** another agent reads only the three checkpoint artifacts
- **THEN** it can identify what is complete, what remains, and the first safe
  command to run without reconstructing conversational context

### Requirement: Completion is adjudication-clean, not raw-count-zero

The campaign MUST complete when cycles are zero, every starting suppression is
adjudicated with planted proof for each retained directive, every ESLint block
has an effective-config classification, and all implementation changes are
archived into durable capabilities. Necessary retained suppressions and policy
scopes MUST NOT be represented as unfinished work.

#### Scenario: Evidence-backed debt remains nonzero

- **WHEN** 71 minimal suppressions and 26 distinct policy scopes remain
- **THEN** the campaign is complete if their ledgers and planted probes pass
- **AND** future reduction is a new backlog item, not missing implementation
