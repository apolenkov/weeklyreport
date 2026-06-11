# version-restore-fidelity (DRAFT delta)

> DRAFT: this delta states the invariant versions v2 must satisfy.
> It is captured for design ratification, not for implementation yet.

## ADDED Requirements

### Requirement: A version fully determines the lead report page

A version snapshot MUST capture every field the lead report page
renders (items, risks, decisions, project statuses, stage statuses,
rendered section meta), and restoring a version MUST atomically
replace that entire surface so the page renders exactly the captured
state. Restore MUST NOT merge snapshot data with current state; a
payload whose `schemaVersion` has no registered migration path MUST be
refused, leaving current state untouched.

#### Scenario: Round-trip restore reproduces the captured page state

- **WHEN** a snapshot of section S is captured, S is then edited
  (including stage statuses and project statuses), and the snapshot is
  restored
- **THEN** the mapped section read model deep-equals the read model at
  capture time for every renderable field

#### Scenario: Unknown schemaVersion is refused, never merged

- **WHEN** a restore is attempted with a payload whose `schemaVersion`
  has no registered migration to the current schema
- **THEN** the restore fails with a clear error and the section's
  current state is unchanged

#### Scenario: Restore creates a new version instead of rewriting history

- **WHEN** version N of a section is restored
- **THEN** a pre-restore safety snapshot of the current state is
  captured first, and the version list grows; no existing version row
  is mutated or deleted by the restore
