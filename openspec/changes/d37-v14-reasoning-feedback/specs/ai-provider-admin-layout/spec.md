## ADDED Requirements

### Requirement: Custom reasoning feedback follows input correction

The Provider form at `/admin?tab=ai` MUST clear its local missing-custom-reasoning error and invalid marker when the generation input is corrected to an admitted custom value or changes to a mode that does not require that value. Whitespace-only or otherwise invalid custom input and unrelated generation-model edits MUST NOT retire that error. Input correction MUST NOT submit a draft or change provider, credential or server validation policy.

#### Scenario: Administrator corrects missing custom reasoning

- **WHEN** a blank custom reasoning submission shows the local error and the administrator enters an admitted nonblank custom value
- **THEN** the stale error and invalid marker disappear
- **AND** no draft is submitted until the administrator explicitly submits

#### Scenario: The missing value remains unresolved

- **WHEN** the administrator enters only whitespace or changes an unrelated generation model after a missing-custom-value error
- **THEN** the custom value remains marked invalid with its error
- **AND** blank custom submission remains refused

#### Scenario: Administrator selects a mode without a custom value

- **WHEN** the administrator changes from custom reasoning to Provider default or Off after a missing-custom-value error
- **THEN** that no-longer-applicable local error is retired
- **AND** the existing explicit submit flow remains unchanged
