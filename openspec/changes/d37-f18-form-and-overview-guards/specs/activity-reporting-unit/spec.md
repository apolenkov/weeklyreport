## ADDED Requirements

### Requirement: The activity status refusal notice reflects the observed alarm floor

When a pick is refused by the record-only alarm floor, the refusal notice
MUST remain tied to the alarm floor observed at pick time. An observed change
of that floor — including its removal and any later reappearance — MUST
invalidate the stored notice without requiring another pick. Only a new
refused pick MAY raise the notice again, and an unchanged floor MUST preserve
it.

#### Scenario: The covering risk is resolved after a refused pick

- **GIVEN** an activity whose pick was refused by a covering alarm floor
- **WHEN** the observed alarm floor lifts without another pick
- **THEN** the refusal notice is no longer rendered
- **AND** lowering the status is permitted again

#### Scenario: A floor reappears without a new pick

- **WHEN** the observed alarm floor returns after having lifted
- **THEN** the earlier refusal notice stays cleared
- **AND** only a new refused pick shows it again

### Requirement: Unified activity editing commits only against a live own target

A unified activity edit or delete captured in a dialog MUST re-resolve its
target against the latest entries in the same week before committing:
exactly the captured physical id, else exactly one own row sharing the
captured stable lineage in that week. When no safe target exists — the row is
missing, moved, foreign, ambiguous or still unreconciled — the commit MUST
NOT notify the parent, MUST keep the dialog state and unsaved input, and
MUST surface an explicit recovery error. An accepted save MUST write the
resolved live identity while preserving the user's edited fields.

#### Scenario: A save response reminted the physical id

- **GIVEN** an open editor for a row whose physical id changed after a save
- **WHEN** the stable lineage resolves to exactly one own row in the same week
- **THEN** the edit commits to the live identity without duplicating the row
- **AND** the editor closes

#### Scenario: The captured target no longer resolves

- **WHEN** the captured row cannot be resolved to one live own row in its
  original week
- **THEN** no parent write is emitted
- **AND** the dialog stays open with an explicit error until deliberate
  dismissal
