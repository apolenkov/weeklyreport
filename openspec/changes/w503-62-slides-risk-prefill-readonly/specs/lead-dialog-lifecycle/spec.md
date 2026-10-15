## ADDED Requirements

### Requirement: A refused Blocker prefill MUST NOT seed a later Risk add

When a Blocker quick-add opens no editor because the report is read-only, the
prefill it carried (stages, blocked severity) MUST NOT be applied to any editor
opened afterwards. A manual Risk add on the report once it is editable MUST open
the Risk editor without a prefilled severity or stages.

#### Scenario: a manual Risk add follows a refused Blocker add

- **GIVEN** a Lead report in Slides that is read-only
- **WHEN** a Blocker quick-add is raised and opens no editor
- **AND** the report becomes editable
- **AND** the lead chooses Risk from `+ Add`
- **THEN** the Risk editor opens with no prefilled severity and no prefilled stages

The host MUST consume the refused signal so it is not replayed merely because
readOnly later becomes false. An accepted prefill MUST retain its supplied
product or activity parent, stage names and severity. This does not permit
replay across host remounts or loosen existing read-only save guards.

#### Scenario: an editable host accepts a prefill

- **GIVEN** the host is editable and receives a new product or activity prefill
- **WHEN** it opens the create dialog
- **THEN** the supplied parent, stage names and severity reach that dialog unchanged

#### Scenario: editing permission returns after a refusal

- **GIVEN** a prefill signal was consumed and refused while read-only
- **WHEN** the host becomes editable without a new signal
- **THEN** no create dialog opens automatically
