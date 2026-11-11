## REMOVED Requirements

### Requirement: Overview week moves MUST be reachable from hover icons and keyboard shortcuts

**Reason**: Mockup v2.4 removes the hover reveal. The week move is always visible in each record's fixed actions column, and move eligibility now includes a re-check of the target week and the derived next-step rule.
**Migration**: Use "Overview week moves MUST be reachable from visible icons and keyboard shortcuts" below.

## ADDED Requirements

### Requirement: Overview week moves MUST be reachable from visible icons and keyboard shortcuts

Each This week or Next week record MUST show a week-move icon in its fixed actions column, always visible. Activating it MUST move the record to the other week as one saved change, without a drag. Alt+Right MUST move a focused record to This week and Alt+Left to Next week, and MUST call preventDefault while focus is in the report grid outside text fields. A refused move MUST change nothing and state its reason.

#### Scenario: The week-move icon moves a record

- **WHEN** the lead activates the move icon of an eligible This week record
- **THEN** the record becomes a Next week record with its status hidden, and no second record of the same plan appears in either week
- **AND** focus stays on the move control of the moved record and the change is announced as `Moved to Next week.`

#### Scenario: A Next week record moves back to This week

- **WHEN** the lead activates the move icon of a Next week record
- **THEN** it becomes a This week record and its status is shown again

#### Scenario: An occupied target rejects the move

- **WHEN** the target week already holds a record of the same plan lineage
- **THEN** the move is refused with the reason `Next week already has this item.` (or the This week equivalent), nothing changes, and the target is checked again immediately before any move is applied

#### Scenario: Alt+Arrow moves the focused record

- **WHEN** the lead presses Alt+Right on a Next week record, or Alt+Left on a This week record, outside text fields
- **THEN** the record moves to the other week and the key does not trigger browser history navigation

#### Scenario: A shortcut with no applicable direction does nothing

- **WHEN** the lead presses Alt+Right on a record already in This week, or Alt+Left on a record already in Next week
- **THEN** nothing moves and `Already in This week. Nothing was moved.` (or the Next week equivalent) is announced

#### Scenario: A refused move announces its reason

- **WHEN** the lead activates a disabled move icon or presses Alt+Arrow on it
- **THEN** its reason, the same text as its tooltip and accessible description, is announced and nothing moves

#### Scenario: A touch user sees the reason as a message

- **WHEN** a coarse-pointer user activates a disabled move icon
- **THEN** the reason shows as a message at the bottom of the screen, because tooltips do not open on touch

#### Scenario: Move is refused for Done, closed, derived and locked records

- **WHEN** a record is Done, closed as Won't do, a derived next step, in a read-only or lost-assignment report, another person's, or has unsaved changes
- **THEN** its move icon is aria-disabled with the matching reason and no move is applied

#### Scenario: A move on a phone keeps the open tab

- **WHEN** the table is in the tabs layout and a record moves to the other week
- **THEN** the open tab does not change, and the message offers `Show`, which opens the destination tab only when activated

#### Scenario: A next step moves with its record

- **WHEN** a record with a next step is moved, or a next step is shown under an item
- **THEN** the next step belongs to its record, moves with it, and shows as a derived `Next step` row under the record in Next week
- **AND** that derived row's move icon is aria-disabled with its reason, and its Edit control opens the source next step and its discussion is the source record's

#### Scenario: Undo of a move follows the one Undo rule

- **WHEN** the lead activates Undo after a move
- **THEN** the Undo rule of `lead-status-overview-actions` applies, a refused Undo changes nothing, and restoring text never overwrites text typed since
