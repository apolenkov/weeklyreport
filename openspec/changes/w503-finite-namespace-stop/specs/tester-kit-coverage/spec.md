# Spec Delta

## ADDED Requirements

### Requirement: Accepted tester stop bounds namespace deletion waiting

`deploy/tester-kit/stop.sh` MUST use a finite namespace-deletion wait after its context/namespace guard and user confirmation. After a deletion timeout or error it MUST attempt all three port-forward cleanups and return the deletion failure status. Cancellation MUST preserve the namespace and forward records without deletion or cleanup.

#### Scenario: Namespace finalizers prevent deletion completion

- **WHEN** an accepted stop reaches the finite deletion wait limit
- **THEN** it attempts cleanup for app, keycloak, and mailpit forwards
- **AND** it exits with the deletion timeout failure instead of reporting success

#### Scenario: Deletion fails and cleanup also fails

- **WHEN** namespace deletion and a forward cleanup both fail
- **THEN** every forward cleanup is attempted
- **AND** the deletion failure status remains the script exit status

#### Scenario: Operator cancels stop

- **WHEN** the operator declines deletion confirmation
- **THEN** no namespace deletion or forward cleanup is attempted
- **AND** the script exits successfully with a cancellation message
