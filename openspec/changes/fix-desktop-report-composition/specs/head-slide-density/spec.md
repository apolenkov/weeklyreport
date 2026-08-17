## ADDED Requirements

### Requirement: Hosted density selection belongs to report context chrome

The Head and hosted Lead slide density selections MUST remain reversible between Document and Presentation while rendering inside their shared report context toolbars. Moving either control MUST NOT refetch, discard, reorder, or duplicate report records. A standalone Lead deck MAY retain its own density control.

#### Scenario: Head switches presentation density

- **WHEN** the Head changes Document to Presentation from the context toolbar
- **THEN** the active deck updates to the selected density without an extra toolbar row
- **AND** all source record identities remain represented exactly once according to the existing density contract

#### Scenario: Lead switches presentation density from report context

- **WHEN** a Lead changes Document to Presentation from the hosted report context toolbar
- **THEN** the active deck updates to the selected density without an extra deck density row
- **AND** fullscreen behavior remains available through the existing report toolbar control
- **AND** all source record identities remain represented exactly once according to the existing density contract
