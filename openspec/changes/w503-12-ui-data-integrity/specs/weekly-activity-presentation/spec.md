## ADDED Requirements

### Requirement: Unavailable activity details preserve saved records

The Head report activity overview SHALL display saved activity-backed records whose activity details are absent from the section read model in an explicitly labeled unavailable-details group. It MUST NOT invent an activity name or status, omit those records, or include product-only records in that group.

#### Scenario: An activity is detached after records were saved

- **WHEN** a Lead saves activity-backed current and next items, risks, or decisions and an administrator detaches that activity from the Lead
- **THEN** the Head report overview retains the saved records under their section author with an unavailable-details label
- **AND** records with available activity details remain in their existing activity group without duplication

### Requirement: Dirty weekly activity fields detect a changed saved base

The Lead weekly activity editor SHALL retain its original saved title and description base while local edits are pending. If incoming saved fields differ from that normalized base, it SHALL preserve the local text, display a stale-data warning, and reject Save until the Lead cancels and reopens the editor.

#### Scenario: A server refresh arrives while the editor is dirty

- **WHEN** a Lead edits weekly activity fields and receives newer saved title or description values before saving
- **THEN** the pending text remains visible with a stale-data warning
- **AND** both Save activation and form submission are blocked without sending the pending fields
- **AND** Cancel closes the editor and reopening displays the latest saved fields

#### Scenario: Catalogue labels change without a saved field conflict

- **WHEN** only the catalogue name changes or incoming saved fields normalize to the original base
- **THEN** the pending weekly fields remain editable without a stale-data warning

#### Scenario: A clean editor receives newer saved fields

- **WHEN** newer saved fields arrive before local edits begin
- **THEN** the editor displays the new values as its saved base

#### Scenario: Stale warning is announced and describes Save

- **WHEN** authoritative weekly fields change while local input remains dirty
- **THEN** the stale warning is mounted as a separate alert in the editor caption slot
- **AND** the disabled Save control describes that alert through aria-describedby
- **AND** existing input, focus and Cancel/reopen recovery remain available
