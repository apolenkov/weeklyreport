## ADDED Requirements

### Requirement: The basic Overview editor MUST state why an invalid plan blocks Save

When the item's next step makes the update invalid, a blocked Save MUST show the
actual validation message in an alert, reveal the next-step field so the lead can
clear it in place, and MUST move focus to that field. The editor MUST keep the
lead's draft until the lead cancels.

#### Scenario: A completed item still carries a next step

- **GIVEN** the Overview editor is open on an item that has a next step
- **WHEN** the lead chooses Done and activates Save update
- **THEN** no update is saved
- **AND** the alert states that a completed item cannot have a next step
- **AND** the next-step field is revealed and focused, with the lead's other edits kept
