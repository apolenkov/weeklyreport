# record-status-derivation — delta

## ADDED Requirements

### Requirement: Pausing an item requires and records a reason

When a lead pauses an item, the UI MUST require a non-blank reason before the
pause takes effect, and the reason MUST be persisted with the item
(`Item.pausedReason`) and surfaced on the item card. Both pause entry points —
the quick "Pause" action on a current-week card and the "Paused" status choice
in the item edit dialog — MUST enforce the reason. The requirement is enforced
at the UI entry points, not as a hard schema invariant, so legacy paused rows
that predate the field still load and round-trip. Leaving the paused status
clears the reason.

#### Scenario: the quick pause action requires a reason

- **WHEN** the lead clicks Pause on a current-week in-progress item
- **THEN** a reason prompt opens and the item is not paused until a non-blank
  reason is confirmed
- **AND** the confirmed reason is persisted and shown on the card as a
  "Paused: …" line

#### Scenario: the edit dialog requires a reason for the paused status

- **WHEN** the lead selects the Paused status in the item edit dialog
- **THEN** a required reason field appears and the item cannot be saved while it
  is blank

#### Scenario: editing a paused item preserves its reason

- **GIVEN** a paused item with a reason
- **WHEN** the lead opens the edit dialog, changes an unrelated field, and saves
  while keeping the Paused status
- **THEN** the pause reason is preserved, not dropped

#### Scenario: leaving the paused status clears the reason

- **GIVEN** a paused item with a reason
- **WHEN** the item moves to any non-paused status
- **THEN** its pause reason is cleared
