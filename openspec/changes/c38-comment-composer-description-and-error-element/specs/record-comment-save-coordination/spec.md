# Spec Delta

## ADDED Requirements

### Requirement: The comment composer description keeps every live reference

The review-comment text field's accessible description MUST include the
character counter, the validation error while one is shown, and the feedback
message while one is shown. A validation error MUST NOT remove the feedback
reference. The limit hint MUST stay present while a validation error shows,
and the validation error MUST be a separate element carrying `role="alert"`.

#### Scenario: A delete outcome shows beside a draft error

- **WHEN** a reviewer holds an invisible-only draft and deletes a comment
- **THEN** the field's description contains the validation error and the
  delete outcome
- **AND** the field stays marked invalid

#### Scenario: A valid draft with feedback

- **WHEN** a reviewer holds a valid draft and a delete outcome is shown
- **THEN** the field's description contains the counter and the delete outcome
- **AND** the field is not marked invalid

#### Scenario: The hint survives a validation error

- **WHEN** the draft becomes invalid
- **THEN** the limit hint remains and the validation error is announced from
  its own `role="alert"` element
