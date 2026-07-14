## ADDED Requirements

### Requirement: Archived changes reflect implemented reality

An archived change MUST have every requirement it added to `openspec/specs/` either implemented in live source or explicitly annotated as abandoned; archiving with unchecked, unimplemented tasks and no annotation is a process defect to be reconciled.

#### Scenario: Unimplemented requirement discovered in an archive

- **WHEN** a requirement added by an archived change is found unimplemented in live source
- **THEN** the requirement is either re-opened as a new change or annotated as abandoned in the owning spec, and the audit trail records the verdict with evidence
