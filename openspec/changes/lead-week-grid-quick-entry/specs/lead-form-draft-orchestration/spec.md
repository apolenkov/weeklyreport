## MODIFIED Requirements

### Requirement: Stale-version conflicts refetch and surface the reload message

The hook MUST expose the same conflict handler used by autosave, submit, and fill-from. A stale-version conflict MUST refetch `leadForm.byPeriod` and show the canonical form reload/error message instead of silently discarding or marking local edits saved. Unsaved local item text MUST remain visibly recoverable across the conflict and refetch, and stale whole-section content MUST NOT be replayed over newer server data without explicit reconciliation.

#### Scenario: Submit conflict reloads the section

- **WHEN** the submit mutation reports a stale-version conflict
- **THEN** `leadForm.byPeriod` is refetched
- **AND** the lead sees the canonical form reload message

#### Scenario: Autosave conflict suppresses the generic autosave toast

- **WHEN** autosave reports a stale-version conflict
- **THEN** the conflict handler handles the refetch/message path
- **AND** the autosave hook MUST NOT also show the generic autosave failure toast

#### Scenario: Inline item text is retained on conflict

- **GIVEN** a Lead has changed item text locally and another server revision exists
- **WHEN** the save conflicts and the authoritative section is refetched in either order
- **THEN** the Lead can see and recover the unsaved text without a false saved indication
- **AND** unrelated server changes remain intact until the Lead explicitly reconciles the conflict
