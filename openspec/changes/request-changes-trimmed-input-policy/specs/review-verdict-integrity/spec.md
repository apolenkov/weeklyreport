## ADDED Requirements

### Requirement: Request changes preserves raw input under canonical length validation

The Request changes dialog SHALL accept comments by their trimmed Unicode code-point length under the canonical review comment limit, without an additional raw UTF-16 cap or silent clipping. It SHALL retain the entire editable raw draft on local or server rejection. An over-limit submit SHALL show actionable inline feedback and SHALL NOT send a mutation.

#### Scenario: Padded valid reason exceeds the raw length limit

- **WHEN** a reviewer enters a padded reason whose trimmed code-point length is within the review comment limit but whose raw UTF-16 length exceeds it
- **THEN** the dialog retains the entire raw draft and displays the trimmed code-point count
- **AND** submitting sends the canonical trimmed reason

#### Scenario: Non-BMP reason reaches the canonical boundary

- **WHEN** a reviewer enters a reason containing non-BMP characters at the trimmed code-point limit
- **THEN** the dialog accepts it without imposing a UTF-16 length cap
- **AND** the counter and submitted comment agree with canonical validation

#### Scenario: Over-limit rejection and correction

- **WHEN** a reviewer submits a reason exceeding the trimmed code-point limit
- **THEN** the dialog remains open with the exact raw draft and an associated inline error explaining the limit and the need to shorten the reason
- **AND** no mutation is sent
- **WHEN** the reviewer corrects the reason to a valid value
- **THEN** the error clears and a subsequent submit sends one valid trimmed command

#### Scenario: Server rejection retains padding

- **WHEN** the server rejects a valid padded reason
- **THEN** the dialog remains open with the entire raw draft including padding and the server error
