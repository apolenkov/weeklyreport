## ADDED Requirements

### Requirement: Pending Fill From confirmation keeps keyboard focus inside

While the Fill From confirmation (React `alertdialog` "Fill from <week>?") waits
for the fill mutation, its actions MUST stay disabled and busy and keyboard
focus MUST remain inside the dialog; when the focused action becomes disabled,
focus MUST move to the dialog itself. Exactly one fill write MUST be requested.

#### Scenario: focus stays in the dialog after confirming

- **WHEN** a keyboard user confirms "Replace & fill" and the fill request is still pending
- **THEN** the active element is inside the confirmation dialog
- **AND** Tab, Shift+Tab and Escape leave focus inside the still-open dialog
- **AND** only one fill write is requested

#### Scenario: an enabled focused control keeps focus

- **WHEN** the pending phase starts while an enabled control inside the dialog holds focus
- **THEN** that control keeps focus

#### Scenario: focus returns after the pending fill settles

- **WHEN** the pending fill completes and the confirmation closes
- **THEN** focus returns to the Fill From segment that opened it
