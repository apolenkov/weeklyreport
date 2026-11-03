## ADDED Requirements

### Requirement: The item comment control has a visible, authorized result

The item comment control MUST reveal a visible view of the record's authorized comments, including an honest empty state. Pointer, keyboard and focus behavior MUST be meaningful, with existing privacy and lifecycle rules preserved.

#### Scenario: No comments exist

- **WHEN** a Lead activates the comment control on their own editable item without comments
- **THEN** a visible comments view shows an honest empty state
- **AND** it does not claim a message was sent or add a comment without an authorized submission

#### Scenario: A record has reviewer comments

- **WHEN** a Lead activates the comment control on their own item with authorized reviewer comments
- **THEN** the view exposes those comments for that record and does not reveal another author's private comments
