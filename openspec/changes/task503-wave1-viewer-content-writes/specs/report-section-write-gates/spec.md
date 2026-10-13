## ADDED Requirements

### Requirement: Viewer cannot write report section content

The reports.saveDraft, reports.submit and leadForm.fillFrom API procedures MUST reject Viewer with FORBIDDEN before invoking section persistence, even if that user remains the section author. Lead, Head and Admin MUST retain own-section writes subject to existing author, lifecycle and version gates. Denials MUST retain role-denied and failed mutation audit events. Report reads and assigned review acknowledgements, comments and verdicts MUST keep their existing permissions.

#### Scenario: A demoted author attempts a content write

- **GIVEN** the current authenticated role is Viewer and a draft section still names that user as its author
- **WHEN** the user saves, submits or fills the section from their own source section
- **THEN** the procedure returns FORBIDDEN without changing the persisted section
- **AND** role-denied and failed mutation audit events are emitted

#### Scenario: Content writer edits their own section

- **GIVEN** a Lead, Head or Admin owns an editable section and provides a valid payload
- **WHEN** they save, submit or fill the section from their own source section
- **THEN** the existing service ownership and lifecycle gates admit the versioned write

#### Scenario: Content writer addresses another author's section

- **WHEN** a Lead, Head or Admin saves, submits or fills a foreign authored section, or fills from a foreign authored source
- **THEN** the existing author guard rejects the write with FORBIDDEN and leaves content unchanged
