## ADDED Requirements

### Requirement: Discarding a failed Overview edit MUST save the restored text

When the lead cancels an Overview editor whose Save update failed and confirms
Discard, the draft save issued by Discard MUST carry the restored item fields,
not the abandoned text. The save MUST run after the restore patch has reached
the draft engine.

#### Scenario: Discard after a failed Save update

- **GIVEN** the lead edited an item's description in Overview and Save update failed
- **WHEN** the lead cancels the editor and confirms Discard
- **THEN** the draft save issued by Discard contains the item's last saved text
- **AND** it does not contain the abandoned text

### Requirement: Sticky completion Retry MUST be unavailable while an Overview update is open

While an Overview update is open (the same pending-input state that disables
Submit and review there), the sticky completion cluster MUST render `Retry saving draft`
disabled, as the header cluster already does. After a failed Save update the
persisted-save barrier ignores a generic force-save, so the editor's own Save
update is the retry.

#### Scenario: Sticky Retry with a failed Save update still open

- **GIVEN** a Save update failed and its editor remains open
- **AND** the header actions have scrolled out of view so the sticky completion actions show
- **WHEN** the sticky `Retry saving draft` button renders
- **THEN** it is disabled
