## ADDED Requirements

### Requirement: A failed autosave MUST NOT present as Saved in any commit

When autosave fails, the Retry control MUST present `Retry saving draft` in the
commit that carries the error. The Saved flash MUST NOT outrank an error state,
including in the commit that follows a successful save inside the flash window.

#### Scenario: Autosave fails while the Saved flash is showing

- **GIVEN** the Save control shows the Saved flash after a successful save
- **WHEN** autosave leaves the saved state for the error state
- **THEN** the commit that carries the error presents `Retry saving draft`
- **AND** no commit presents `Draft saved` for the error state
