## ADDED Requirements

### Requirement: Item text-length eligibility matches the governing schema

The existing Item next-step and pause-reason length guards SHALL use Unicode code points on the same trimmed values they currently validate. They SHALL preserve the current shared maximum, required pause reason, completed-next-step refusal, parent/stage eligibility and saved null behavior.

#### Scenario: A schema-valid next step or pause reason

- **WHEN** a lead saves an otherwise valid Item with 500 non-BMP code points in its applicable next-step or pause-reason field
- **THEN** the text-length guard permits the existing save callback with the complete value

#### Scenario: The shared maximum still rejects overflow

- **WHEN** the same field contains 501 non-BMP code points
- **THEN** Save is refused, the field retains its value and the existing error/focus behavior applies
