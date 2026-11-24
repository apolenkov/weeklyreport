## MODIFIED Requirements

### Requirement: Move to next week MUST change placement without asserting continuation

In Lead Report Overview and on Lead form week cards, Move to next week on an eligible Current occurrence without a separate next commitment MUST move it to Next, keeping progress, text and `stableId` and clearing `carriedOver`. When the occurrence already carries a saved `nextStepText`, the Overview MUST show the move disabled with its reason and write nothing, while a Lead form week card acknowledges that plan in place. No move MAY run continuation promotion or create a second occurrence.

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

- **GIVEN** an eligible Current occurrence in the Report Overview that already carries a stored `nextStepText`, shown in the Next week cell of the same row
- **WHEN** the lead opens its status menu or its `Move to next week` action in the editing popover
- **THEN** `Move to next week` is present but disabled, and its accessible description and tooltip say "Its next step is already planned in Next week. Edit the next step instead"
- **AND** an unanswered plan on that occurrence offers its `Next week` outcome disabled with the same reason, while its other outcomes stay available
- **AND** activating the disabled item writes nothing: the occurrence keeps Current placement, text, stored progress, `stableId`, `carriedOver` and the saved next step
- **AND** no Next occurrence or second record is synthesized for the lineage, and no continuation-promotion command runs

#### Scenario: the week-card arrow acknowledges the saved plan too

- **WHEN** the lead activates Move to next week on a Current week card in the Lead form that already carries a stored `nextStepText`
- **THEN** the card keeps Current placement, its text, stored progress, `stableId` and the saved next step, and only `carriedOver` is cleared
- **AND** no Next occurrence is synthesized, no continuation-promotion command runs, and the lead is told the occurrence is already planned for the next week

#### Scenario: existing commitments keep their existing handling

- **WHEN** a placement-only move would collide with an explicit Next of the same stable identity
- **THEN** it cannot create or overwrite a second Next
- **AND** the separate Continue next week verdict and the promotion of a derived Next projection into Current remain unchanged
