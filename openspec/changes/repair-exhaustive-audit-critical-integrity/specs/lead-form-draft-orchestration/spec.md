## ADDED Requirements

### Requirement: Transient editing actions are bound to one report generation

The `/lead/report` editor MUST key quick-add state, loaded context, and modal save callbacks by the current report and section identity. A callback captured for one generation MUST NOT read from or write to another generation.

#### Scenario: Navigation occurs with a quick-add modal open

- **WHEN** the user opens quick add for report A and navigation loads report B before the modal saves
- **THEN** the transient modal is closed or invalidated and saving it cannot mutate report B

#### Scenario: First loaded render after navigation

- **WHEN** report B becomes available on the first render after report A
- **THEN** every editor and quick-add callback receives report B's current context in that render and no previous-render ref is observable

#### Scenario: Stale callback is invoked directly

- **WHEN** a callback captured under report A is invoked after report B is active
- **THEN** the generation mismatch is rejected locally and no draft array is merged or autosaved
