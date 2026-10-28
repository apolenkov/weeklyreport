## ADDED Requirements

### Requirement: Concurrent settings draft mutations preserve every edited field

Settings draft edits in the Periods form MUST merge into the latest draft state.
A toggle or field change MUST NOT rebuild the draft from a value captured at
render time, so a mutation applied in the same tick as another mutation keeps
both edits in the saved patch.

#### Scenario: Concurrent settings draft mutations preserve toggle state

- **GIVEN** the Periods form shows the committed unified activity view as off
- **WHEN** a numeric period field edit and the unified activity view toggle are
  applied in the same tick
- **THEN** the draft holds both the numeric value and the toggled value
- **AND** saving submits both values in the period-policy patch
