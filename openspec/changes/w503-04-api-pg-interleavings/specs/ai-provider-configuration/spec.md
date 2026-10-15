## ADDED Requirements

### Requirement: The control read is one consistent snapshot

The AI provider control read MUST return the active pointer, the active
revision and the revision list from one database snapshot, so an activation
that commits during the read cannot pair the previous active pointer with the
new revision lifecycles.

#### Scenario: An activation commits during the control read

- **WHEN** an activation commits after the control row is read and before the revision list is read
- **THEN** the returned revision list marks as active exactly the revision the returned pointer names
