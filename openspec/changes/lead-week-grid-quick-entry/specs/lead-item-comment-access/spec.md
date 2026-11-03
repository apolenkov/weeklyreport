## Purpose

Make authorized record comments understandable and reachable from the Lead Overview.

## ADDED Requirements

### Requirement: The item comment control has a visible, authorized result

The item comment control MUST reveal a visible view of the record's authorized comments, including an honest empty state and an authorized reply composer for the Lead’s own eligible item. Pointer, keyboard and focus behavior MUST be meaningful; the server MUST enforce ownership, role and lifecycle rules.

#### Scenario: No comments exist

- **WHEN** a Lead activates the comment control on their own editable item without comments
- **THEN** a visible comments view shows an honest empty state
- **AND** it does not claim a message was sent or add a comment without an authorized submission

#### Scenario: A record has reviewer comments

- **WHEN** a Lead activates the comment control on their own item with authorized reviewer comments
- **THEN** the view exposes those comments for that record and does not reveal another author's private comments

#### Scenario: A Lead replies to their own item

- **GIVEN** an eligible item belonging to the Lead's own report section
- **WHEN** the Lead submits a valid reply in its discussion
- **THEN** the server records the reply on that exact item under the authenticated author
- **AND** the discussion shows the confirmed reply after persistence

#### Scenario: A reply is rejected or fails

- **WHEN** a reply is invalid, unauthorized or cannot be saved
- **THEN** the entered text remains available with an actionable error
- **AND** the interface does not claim it was sent

#### Scenario: Another author's item or frozen history

- **WHEN** a Lead attempts to reply to another author's item or an immutable historical snapshot
- **THEN** the server rejects the write
- **AND** existing authorized reviewer actions remain governed by their established role and lifecycle rules
