## MODIFIED Requirements

### Requirement: Overview item actions MUST be visible and tappable on touch devices

On a touch device, Overview record controls (text, status, discussion count and entry line) MUST NOT depend on pointer hover and MUST have 44 px targets. Tapping a record's text MUST open the editing surface, a bottom Sheet on touch, and moves MUST be reached through the status menu or the Sheet. No Overview card MUST be draggable on any device.

#### Scenario: icons are visible and tappable without hover

- **WHEN** the Overview renders editable records on a touch device
- **THEN** each record's status control and, when comments exist, its discussion icon are visible without hover and operable by tap
- **AND** tapping the status control opens its menu with the week move, and tapping the text opens the editing Sheet

#### Scenario: no card starts a drag

- **WHEN** the lead long-presses or drags an Overview card with a pointer or touch
- **THEN** no drag starts and no occurrence is moved

## REMOVED Requirements

### Requirement: Overview week moves MUST be reachable from hover icons and keyboard shortcuts

**Reason**: Mockup v2.5 removes the per-record move arrow together with the pencil and discussion icons. A move is reached through the status menu or the editing popover, and its eligibility now includes a re-check of the target week and the derived next-step rule.
**Migration**: Use "Overview week moves MUST be reachable from the status menu, the editor and keyboard shortcuts" below. The placement-or-acknowledgement contract in `record-status-derivation` is unchanged.

## ADDED Requirements

### Requirement: Overview week moves MUST be reachable from the status menu, the editor and keyboard shortcuts

A This week record's status menu MUST offer `Move to next week`, and the editing popover of a This week or Next week record MUST offer the icon action `Move to next week` or `Move to this week`. A move is one saved change, without a drag. Alt+Right MUST move a focused This week record to Next week and Alt+Left a Next week record to This week, calling preventDefault in the grid outside text fields. An impossible move stays aria-disabled with its reason and changes nothing.

#### Scenario: A move from the status menu

- **WHEN** the lead chooses `Move to next week` in the status menu of an eligible This week record
- **THEN** the record becomes a Next week record with its status hidden, and no second record of the same work appears in either week
- **AND** focus lands on the moved record's text control and `Moved to Next week.` is announced

#### Scenario: A Next week record moves back from its popover

- **WHEN** the lead activates `Move to this week` in the editing popover of a Next week record
- **THEN** the record becomes a This week record and its status is shown again
- **AND** an unsaved draft in that popover is saved or cancelled first, and `Save or cancel your changes first.` is announced otherwise

#### Scenario: An occupied target rejects the move

- **WHEN** the target week already holds a record of the same work
- **THEN** the move is refused with `Next week already has this item.` (or `This week already has this item.`), nothing changes, and the target is checked again immediately before any move is applied

#### Scenario: Alt+Arrow moves the focused record

- **WHEN** the lead presses Alt+Right on a This week record, or Alt+Left on a Next week record, outside text fields
- **THEN** the record moves to the other week and the key does not trigger browser history navigation

#### Scenario: A shortcut with no applicable direction does nothing

- **WHEN** the lead presses Alt+Right on a record already in Next week, or Alt+Left on a record already in This week
- **THEN** nothing moves and `Already in Next week. Nothing was moved.` (or the This week equivalent) is announced

#### Scenario: A refused move announces its reason

- **WHEN** the lead activates a disabled move item or presses Alt+Arrow on a record that cannot move
- **THEN** its reason, the same text as its tooltip and accessible description, is announced and nothing moves

#### Scenario: A touch user sees the reason as a message

- **WHEN** a coarse-pointer user activates a disabled move item
- **THEN** the reason shows as a message at the bottom of the screen, because tooltips do not open on touch

#### Scenario: Move is refused for Done, closed, unsaved and locked records

- **WHEN** a record is Done, closed as Won’t do, unsaved after a failed save, in a read-only or lost-assignment report, or another person's
- **THEN** its move item is aria-disabled with the matching reason (`Done items stay in This week`, `Closed as Won’t do. Restore it first`, `Not saved yet. Retry or discard the change first`, `Read-only report`, `Assignment ended. Entries are read-only`, `Another person’s item. Only its owner can change it`) and no move is applied

#### Scenario: A saved next step blocks a plain move

- **WHEN** a This week record carries a saved next step and the lead looks at its `Move to next week`
- **THEN** the item is aria-disabled with `Its next step is already planned in Next week. Edit the next step instead`, and the record stays in This week with its result and its step
- **AND** no continuation-promotion command runs and no Next record is synthesized

#### Scenario: A derived next step cannot move

- **WHEN** the lead opens the popover of a derived `Next step` line
- **THEN** the popover offers no Move action, because a next step travels with its item and is changed by editing the step

#### Scenario: A move on a phone keeps the open tab

- **WHEN** the table is in the tabs layout and a record moves to the other week
- **THEN** the open tab does not change, and the message `Moved to Next week.` offers `Show`, which opens the destination tab only when activated

#### Scenario: Undo of a move follows the one Undo rule

- **WHEN** the lead activates Undo after a move
- **THEN** the Undo rule of `lead-overview-save-safety` applies, a refused Undo changes nothing, and restoring text never overwrites text typed since
