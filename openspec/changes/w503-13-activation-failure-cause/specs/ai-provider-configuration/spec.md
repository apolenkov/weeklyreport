## ADDED Requirements

### Requirement: A failed preparation records a closed cause

When embedding preparation fails during activation, the
`ai_provider.activation_failed` audit event MUST carry a `cause` from a closed
set: `preparation_exception` when preparation throws, and
`preparation_incomplete` when it returns failed or missing vectors. The audit
MUST NOT record the exception's name, message, stack or cause. A conflict error
MUST keep its separate handling.

#### Scenario: Preparation throws

- **WHEN** preparation rejects with an error whose message or name contains a secret
- **THEN** the audit event has `cause` equal to `preparation_exception`
- **AND** no part of the error appears in the event
- **AND** the previous provider stays active

#### Scenario: Preparation returns an incomplete result

- **WHEN** preparation resolves with failed or missing vectors
- **THEN** the audit event has `cause` equal to `preparation_incomplete`
