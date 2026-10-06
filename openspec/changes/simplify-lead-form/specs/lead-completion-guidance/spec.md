# Spec Delta

## MODIFIED Requirements

### Requirement: Sticky actions and submission explanation stay separate

The submission explanation MUST remain in normal document flow at the end of the editable form. Only the existing compact Save/Add/Submit action cluster MAY be sticky, and it MUST preserve content clearance and safe-area behavior rather than turning the explanatory summary into a persistent banner. While suggested continuations await confirmation, that cluster MUST show their number as a compact `n to review` indicator next to Submit, and the indicator MUST disappear at zero; it MUST NOT add a second banner or replace the end-of-form explanation.

#### Scenario: The lead scrolls through a long report

- **WHEN** the canonical header actions leave the viewport
- **THEN** the existing compact action cluster may appear according to its visibility contract
- **AND** the end-of-form submission explanation remains in document flow without covering report content

#### Scenario: Continuations await review

- **WHEN** two suggested continuations are unconfirmed
- **THEN** the compact cluster shows `2 to review` beside Submit
- **AND** the end-of-form explanation names the same items and remains in document flow
