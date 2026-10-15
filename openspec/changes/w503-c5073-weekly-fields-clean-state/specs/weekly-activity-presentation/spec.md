## ADDED Requirements

### Requirement: The weekly-fields draft is dirty only while it differs from the saved values

The Activity weekly-fields editor SHALL treat its draft as dirty only while the
normalized title and description pair (trimmed, blank as null) differs from the
authoritative pair the draft was opened or last reseeded against. While the draft
is not dirty, Save SHALL be disabled, the editor SHALL report no pending edit to
its parent, and the unsaved-edit unload guard SHALL NOT be armed. Stale-server
detection, Reset to catalogue name, Cancel and field validation SHALL behave as
before.

#### Scenario: Typing back to the saved text is clean

- **GIVEN** an Activity with weekly title "Weekly duty" and description "Ship it"
- **WHEN** the lead edits both fields and then restores the original text
- **THEN** Save is disabled, no pending edit is reported and the unload guard is not armed

#### Scenario: Whitespace over an empty field is clean

- **GIVEN** an Activity with no weekly title and no weekly description
- **WHEN** the lead enters only whitespace in both fields
- **THEN** Save is disabled, no pending edit is reported and the unload guard is not armed
