## ADDED Requirements

### Requirement: Notification email form uses shared settings admission

Settings Notifications MUST admit its normalized from-email payload using the same shared settings contract as admin.updateSettings. Invalid syntax and an address over 254 characters MUST show the existing inline error and block Save before mutation. Empty/whitespace clearing, trimming and pending-draft ownership MUST remain unchanged.

#### Scenario: The from-email is too long

- **WHEN** the admin enters a syntactically valid 255-character address
- **THEN** the form shows the linked invalid-email hint and disables Save
- **AND** no update mutation occurs

#### Scenario: Valid input or clear is saved

- **WHEN** the admin enters a valid 254-character address, an ordinary trimmed address or empty/whitespace clear
- **THEN** Save emits the existing normalized address or null payload
