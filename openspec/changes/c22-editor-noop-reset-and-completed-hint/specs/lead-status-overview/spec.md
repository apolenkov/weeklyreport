## ADDED Requirements

### Requirement: The basic Overview editor MUST state why an invalid plan blocks Save

When the Overview item editor does not render the next-step field and the item's
next step makes the update invalid, a blocked Save MUST show the actual validation
message together with the instruction to cancel and use Update status from More
actions, and MUST move focus to that message. The editor MUST keep the lead's
draft until the lead cancels.

#### Scenario: A completed item still carries a next step

- **GIVEN** the Overview editor is open on an item that has a next step
- **WHEN** the lead chooses Done and activates Save update
- **THEN** no update is saved
- **AND** the focused alert states that a completed item cannot have a next step
- **AND** the alert still tells the lead to cancel and choose Update status from More actions
