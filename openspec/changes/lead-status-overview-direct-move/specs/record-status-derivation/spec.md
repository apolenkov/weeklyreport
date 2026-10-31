# Spec Delta: record-status-derivation

## MODIFIED Requirements

### Requirement: Move to next week MUST change placement without asserting continuation

In Lead Report Overview and on Lead form week cards, Move to next week on an eligible Current occurrence without a separate next commitment MUST move that occurrence to Next, preserving stored progress, text, and stable identity while clearing `carriedOver`. On an eligible Current occurrence that already carries a stored `nextStepText`, Move to next week MUST instead acknowledge that entered plan in place: the occurrence keeps Current placement, its text, stored progress, `stableId` and saved `nextStepText`, the acknowledgement clears `carriedOver` through the ordinary draft save, and the canonical editor does not open. This action MUST remain distinct from Continue next week, MUST NOT run a continuation-promotion command for a Current occurrence, and MUST NOT create another occurrence for the same placement.

#### Scenario: postponement changes placement only

- **WHEN** the lead saves Move to next week for an eligible Current occurrence without a separate commitment
- **THEN** that occurrence is Next and no longer Current
- **AND** progress and text are preserved, `carriedOver` is cleared, and no `nextStepText` or Current result is synthesized
- **AND** progress is not set to `postponed` merely because the action means postponement

#### Scenario: cancelling a move leaves placement unchanged

- **WHEN** the lead cancels the move editor under the existing discard rules
- **THEN** no move is written and the occurrence remains Current
- **AND** focus returns to the triggering item control

#### Scenario: Move keeps a saved next step and never promotes

- **WHEN** the lead chooses Move to next week for an eligible Current occurrence that already carries a stored `nextStepText`
- **THEN** the occurrence stays Current and keeps its text, stored progress, `stableId` and the saved next step
- **AND** the acknowledgement clears `carriedOver` through the ordinary draft save, and the canonical editor does not open
- **AND** neither a Next occurrence nor a second record is synthesized for the lineage, and no continuation-promotion command runs
- **AND** the lead is told the occurrence is already planned for the next week

#### Scenario: the week-card arrow acknowledges the saved plan too

- **WHEN** the lead activates Move to next week on a Current week card in the Lead form that already carries a stored `nextStepText`
- **THEN** the card keeps Current placement, its text, stored progress, `stableId` and the saved next step, and only `carriedOver` is cleared
- **AND** no Next occurrence is synthesized, no continuation-promotion command runs, and the lead is told the occurrence is already planned for the next week

#### Scenario: existing commitments keep their existing handling

- **WHEN** a placement-only move would collide with an explicit Next of the same stable identity
- **THEN** it cannot create or overwrite a second Next
- **AND** the separate Continue next week verdict and the promotion of a derived Next projection into Current remain unchanged
