# exhaustive-quality-remediation Specification

## Purpose

Define how an exhaustive quality campaign inventories the full worktree, binds
reviews and finding dispositions to final blobs, and proves completion through
one validated ledger and its generated reports.

## Requirements

### Requirement: The final worktree inventory is complete and explicit

The exhaustive quality campaign MUST inventory every Git-tracked file and every
non-ignored untracked file in the final worktree. The campaign ledger MUST contain
exactly one row per inventoried path and MUST classify generated, vendored, binary,
archived, and maintained files explicitly rather than omitting them through an
unrecorded glob.

#### Scenario: A current path is missing from the ledger

- **WHEN** the ledger validator compares the final worktree inventory with the
  campaign ledger
- **THEN** any missing or duplicate path makes the validator exit nonzero
- **AND** the campaign remains incomplete

#### Scenario: A non-maintained file is inventoried

- **WHEN** a generated, vendored, binary, or archived path exists in the final tree
- **THEN** its ledger row names the applicable classification and objective check
- **AND** the path is not silently excluded from the inventory total

### Requirement: Every terminal file verdict is bound to its final content

Each campaign ledger row MUST store the current file digest, the reviewer or check
identity, the checks performed, and the resulting verdict. A terminal verdict MUST
be invalid when its stored digest differs from the final worktree content, and an
edited file MUST return to pending until its final blob is reviewed again.

#### Scenario: A reviewed file changes

- **WHEN** a file is edited after its terminal review
- **THEN** the ledger validator detects the digest mismatch and exits nonzero
- **AND** a fresh review of the changed blob is required before completion

#### Scenario: A file has only mechanical evidence

- **WHEN** a maintained source file has passing lint, typecheck, and test results but
  no recorded semantic and comment review
- **THEN** its ledger verdict remains pending
- **AND** the mechanical results MUST NOT be converted into an exemplary verdict

### Requirement: Every finding has one current evidence-backed disposition

The campaign MUST preserve stable identities for all 709 accepted starting findings
and MUST record every newly discovered finding in the same ledger. Each concrete
finding MUST end as `fixed`, `overturned`, or `retained`; an overturned or retained
finding MUST include direct final-source evidence and rationale. Generic findings
MUST expand into concrete per-file instances without double counting their parent.

#### Scenario: A generic finding affects several files

- **WHEN** source review proves that a generic accepted finding applies to multiple
  current files
- **THEN** the ledger records one concrete child instance for each affected file
- **AND** aggregate counts do not count both the parent and its children as separate
  defects

#### Scenario: A finding is declared fixed

- **WHEN** a finding receives the `fixed` disposition
- **THEN** its evidence names the final source location and the verification that
  exercises the correction
- **AND** a later edit that invalidates that evidence reopens the finding

### Requirement: Completion reports are generated from the validated ledger

The consolidation, roadmap, Markdown reports, handoff, and rendered HTML MUST be
projections of one validated final ledger. Each generated artifact MUST identify the
ledger digest it represents. Report text MUST NOT override a failed ledger invariant
or claim server-side CI evidence when only local verification ran.

#### Scenario: A report is stale

- **WHEN** a generated report's recorded ledger digest differs from the validated
  final ledger digest
- **THEN** the report check exits nonzero
- **AND** the artifact MUST be regenerated before completion

#### Scenario: The owner waives server CI

- **WHEN** the final report summarizes verification
- **THEN** it records server-side CI as explicitly waived
- **AND** it reports exact local commands and outcomes without representing them as CI

### Requirement: Completion requires zero unresolved scope

The campaign MUST NOT complete until the final inventory has zero pending rows, zero
invalid terminal rows, zero undisposed findings, zero unproved product exceptions,
and all required local verification and render checks pass. Historical grades,
sampled review, or a green aggregate command MUST NOT substitute for any of these
conditions.

#### Scenario: One file remains pending

- **WHEN** every gate passes but one current file lacks a valid final-blob verdict
- **THEN** the completion validator exits nonzero
- **AND** the campaign MUST be reported as incomplete
