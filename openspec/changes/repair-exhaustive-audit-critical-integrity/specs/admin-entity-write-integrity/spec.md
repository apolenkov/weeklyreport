## ADDED Requirements

### Requirement: Project-activity group moves and lead attachments preserve group equality atomically

The `projectActivity` update and `attachLead` repository operations MUST validate the activity group, every attached lead group, and the requested mutation within one serializable transaction or an equivalent database-enforced atomic command.

#### Scenario: Attach races with a group move

- **WHEN** lead attachment validates the old group while a concurrent transaction moves the activity
- **THEN** at most one transaction commits and the final database contains no cross-group attachment

#### Scenario: Group move races with an attachment

- **WHEN** a group move validates the existing lead set while a concurrent transaction attaches a lead from the old group
- **THEN** at most one transaction commits and the losing operation returns a typed retryable conflict

#### Scenario: Matching groups remain valid

- **WHEN** the activity and lead remain in the same group for the complete transaction
- **THEN** attachment or group movement commits once without changing unrelated edges
