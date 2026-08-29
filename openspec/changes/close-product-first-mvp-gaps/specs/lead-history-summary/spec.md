## ADDED Requirements

### Requirement: Compiled history does not invent lead submission state

The reports-history React route MUST NOT render `Submitted: Not submitted` for a compiled published or archived entry when the compiled history contract has no lead-specific submission timestamp. Lead-specific draft history MAY retain the explicit not-submitted state.

#### Scenario: Published compiled card is rendered

- **WHEN** a published compiled history entry has publication metadata but no lead submission timestamp
- **THEN** the card shows its published state and MUST NOT show `Not submitted`

#### Scenario: Draft lead card lacks a timestamp

- **WHEN** a lead-specific draft entry has no submission timestamp
- **THEN** the card continues to show `Not submitted`
