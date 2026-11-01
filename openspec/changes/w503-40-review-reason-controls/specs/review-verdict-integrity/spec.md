## MODIFIED Requirements

### Requirement: Request changes asks for the reason before mutating

Both Request changes entry points (review panel and dashboard queue) MUST open a comment dialog and MUST send the mutation only on submit with valid text. The dialog MUST move focus into the field, show an inline error for empty input, disable submit while pending, keep the explanatory reason hint visible next to any feedback, announce a rejected request in a separate alert, mark the reason field invalid only when its own value fails validation, and keep the typed text on rejection.

The dialog MUST accept a comment by its trimmed Unicode code-point length under the canonical review comment limit, without an additional raw UTF-16 cap or silent clipping, and MUST retain the entire editable raw draft on local or server rejection. An over-limit submit MUST show actionable inline feedback and MUST NOT send a mutation.

#### Scenario: Empty submit

- **WHEN** the Head submits the dialog with no text
- **THEN** an inline error is shown and no mutation is sent
- **AND** the reason field is marked invalid and the explanatory hint stays visible

#### Scenario: Reason value fails validation

- **WHEN** the Head submits an empty or over-limit reason
- **THEN** the reason field is marked invalid and the inline error explains the problem
- **AND** no mutation is sent and the typed text stays in the field

#### Scenario: Server rejects a valid reason

- **WHEN** the request for a validated reason fails with a version conflict or a transport failure
- **THEN** the reason field is not marked invalid and the explanatory hint stays visible
- **AND** the rejection is announced in a separate alert and the typed text is kept

#### Scenario: Padded valid reason exceeds the raw length limit

- **WHEN** a reviewer enters a padded reason whose trimmed code-point length is within the review comment limit but whose raw UTF-16 length exceeds it
- **THEN** the dialog retains the entire raw draft and displays the trimmed code-point count
- **AND** submitting sends the canonical trimmed reason

#### Scenario: Non-BMP reason reaches the canonical boundary

- **WHEN** a reviewer enters a reason containing non-BMP characters at the trimmed code-point limit
- **THEN** the dialog accepts it without imposing a UTF-16 length cap
- **AND** the counter and submitted comment agree with canonical validation

#### Scenario: Over-limit rejection

- **WHEN** a reviewer submits a reason exceeding the trimmed code-point limit
- **THEN** the dialog remains open with the exact raw draft and an associated inline error explaining the limit and the need to shorten the reason
- **AND** no mutation is sent

#### Scenario: Correction after an over-limit rejection

- **WHEN** the reviewer corrects the reason to a valid value
- **THEN** the error clears and a subsequent submit sends one valid trimmed command

#### Scenario: Server rejection retains padding

- **WHEN** the server rejects a valid padded reason
- **THEN** the dialog remains open with the entire raw draft including padding and the server error

## ADDED Requirements

### Requirement: The reason dialog owns the section's next verdict write

While the Request changes reason dialog is open for a section, the review panel's section verdict control (`SectionVerdictControl`) MUST keep that section's Approve and Request changes buttons inactive: they MUST NOT arm or send a verdict, MUST expose the inactive state through `aria-disabled`, and MUST leave the section's verdict write to the dialog. The dialog's submit MUST be the only armed verdict write until it closes, after which the controls MUST return to their normal pending gating.

#### Scenario: The reason dialog owns the verdict write

- **WHEN** the reviewer opens the Request changes dialog for a section
- **THEN** that section's Approve and Request changes controls are inactive and activating them sends no verdict
- **AND** the dialog remains the section's only armed verdict writer

#### Scenario: Closing the dialog restores the controls

- **WHEN** the reviewer closes the reason dialog without submitting a verdict
- **THEN** the controls are active again unless a verdict is pending for the section
- **AND** no verdict was written by the closed dialog
