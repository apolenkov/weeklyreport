## ADDED Requirements

### Requirement: Comment feedback uses the existing code-point budget

The comment composer SHALL classify length feedback using the same code-point length as its current schema and character counter. Unsupported drafts within the existing budget SHALL retain the current visible-character refusal without a false over-limit error. This requirement does not change the limit, schema, raw draft retention or mutation admission.

#### Scenario: Unsupported draft remains within the code-point budget

- **WHEN** an invalid raw draft contains 1000 non-BMP characters and one unsupported NUL code point
- **THEN** the composer displays 1001 / 2000 and its existing visible-character refusal
- **AND** it retains the draft and does not submit a mutation

#### Scenario: Actual overflow retains its current refusal

- **WHEN** a raw draft contains 2001 non-BMP code points
- **THEN** the composer retains it and reports the existing over-limit refusal
- **AND** submission is permitted only after correction to a schema-valid draft within the existing budget
