## ADDED Requirements

### Requirement: The lead-form draft flow is one deep module

The lead-form draft lifecycle (draft state, reconciliation, save and save-echo classification, optimistic-lock versioning, submit readiness, submit, merge application) MUST be owned by one module exposing one handle (`draft`, `dirty`, `version`, `save`, `submit`, `submitReadiness`, `apply`, plus the named branching handlers with their pending-request values); the form MUST NOT thread live data between hooks through cross-file mutable-ref protocols (a single module-internal render-to-callback ref inside the module's own file is permitted), and downstream components MUST NOT receive whole hook return types as props.

#### Scenario: Draft interactions are unit-testable through the handle

- **WHEN** a test drives quick-add, save, conflict, and submit through the module's handle with a fake write seam
- **THEN** the sequencing that previously depended on per-render ref refreshes is exercised deterministically in one unit test file

#### Scenario: No ref smuggling survives

- **WHEN** the lead form renders
- **THEN** no component or hook repopulates a mutable ref each render to expose live state to another file

#### Scenario: Components declare narrow interfaces

- **WHEN** a lead-form child component's props are inspected
- **THEN** each field is a value or handler the component itself reads
- **AND** no props type references `ReturnType<typeof useLeadFormDraftMerges>` or sibling hook types

#### Scenario: Behavior is unchanged

- **WHEN** the pre-refactor characterization suite (autosave, save-echo, optimistic lock, quick-add, submit gating) runs against the deepened module
- **THEN** every assertion passes without modification
