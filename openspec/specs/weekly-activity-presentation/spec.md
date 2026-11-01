# weekly-activity-presentation Specification

## Purpose

Allow a lead to describe an Activity for a particular report week without changing the shared catalogue or another report's published presentation.

## Requirements

### Requirement: Weekly Activity fields belong to the lead report section

The Activity authoring form and section save procedure MUST support a weekly title and description for each Activity in the owning lead's selected report section. They MUST NOT rename the catalogue entry or mutate another lead/week.

#### Scenario: Two leads and two weeks

- **WHEN** lead A edits an Activity title and description in week 1
- **THEN** A's week 1 reads back both values
- **AND** lead B's week 1, both leads' week 2 and the catalogue name remain unchanged

### Requirement: Reset and omission preserve intentional values

The section save procedure MUST preserve omitted weekly fields, clear explicitly reset fields and reject values beyond the shared title/description boundaries. A reset title MUST display the catalogue name in the live report; a reset description MUST be empty.

#### Scenario: Partial save and explicit reset

- **WHEN** a saved weekly title exists and a later save omits that field
- **THEN** the weekly title remains unchanged
- **WHEN** the lead explicitly clears or resets it
- **THEN** the live title uses the catalogue name without renaming the catalogue

#### Scenario: Invalid input and read-only section

- **WHEN** a weekly value exceeds its shared limit or the section is not editable by the actor
- **THEN** the save does not mutate the section
- **AND** recoverable input remains available with concise feedback

### Requirement: Weekly initialization does not silently copy presentation

New Activity rows MUST start without weekly title and description overrides. Ordinary carry-over and fill-from MUST preserve their existing target Activity presentation behavior rather than copying another week's text implicitly.

#### Scenario: Next week creation

- **WHEN** the next report week initializes the same Activity
- **THEN** its title falls back to the catalogue name and its description starts empty
- **AND** the previous week's stored fields remain unchanged

### Requirement: Published Activity presentation is immutable

Published report, Viewer, slides and PDF consumers MUST use the effective title and description frozen at publication. Old snapshots MUST retain their stored labels without consulting the mutable catalogue for replacement text.

#### Scenario: Catalogue and draft change after publication

- **WHEN** an Activity report is published and its catalogue name or later draft fields change
- **THEN** the published report, Viewer, slides and PDF retain the originally published title and description

### Requirement: Weekly edits follow canonical save conflict handling

Activity edits MUST use section version checking and preserve pending input on failure. A stale save MUST NOT overwrite a newer section.

#### Scenario: Concurrent save

- **WHEN** two editors save against the same prior section version
- **THEN** the stale request receives the existing conflict outcome
- **AND** its local input remains recoverable without overwriting the newer title or description

#### Scenario: Weekly field editor limits and historical Activities

- **WHEN** the Overview weekly-fields editor holds a title over 200 or a description over 500 characters
- **THEN** it shows an English error beside the field, programmatically associated with it (`aria-invalid`, `aria-describedby`), and sends no write
- **AND** the typed text is neither truncated nor lost, and values at exactly the limits are accepted
- **WHEN** the Activity unit is historical
- **THEN** the unit stays visible but has no weekly-fields editor or Save action

### Requirement: Weekly Activity fields MUST be disclosed on demand

The weekly title and description inputs of an Activity MUST NOT be permanently rendered below the Activity's timeline. They MUST open only when the lead activates the Activity's edit control, and saving, resetting to the catalogue name and cancelling MUST follow the existing section save and conflict handling. An Activity that has a weekly title or description MUST show that value as read-only text in the Activity header.

#### Scenario: An Activity has no weekly override

- **WHEN** the lead views a Project Activity without weekly fields
- **THEN** no weekly input is visible and the Activity shows the same Previous, Current and Next columns as a product

#### Scenario: The lead edits weekly fields

- **WHEN** the lead activates the Activity edit control
- **THEN** the weekly title and description inputs open with Save, Cancel and Reset to catalogue name
- **AND** cancelling closes them and returns focus to the edit control

### Requirement: The weekly-fields draft is dirty only while it differs from the saved values

The Activity weekly-fields editor SHALL treat its draft as dirty only while the
normalized title and description pair (trimmed, blank as null) differs from the
authoritative pair the draft was opened or last reseeded against. While the draft
is not dirty, Save SHALL be disabled, the editor SHALL report no pending edit to
its parent, and the unsaved-edit unload guard SHALL NOT be armed. Stale-server
detection, Reset to catalogue name, Cancel and field validation SHALL behave as
before.

#### Scenario: Typing back to the saved text is clean

- **GIVEN** an Activity with weekly title "Weekly duty" and description "Ship it"
- **WHEN** the lead edits both fields and then restores the original text
- **THEN** Save is disabled, no pending edit is reported and the unload guard is not armed

#### Scenario: Whitespace over an empty field is clean

- **GIVEN** an Activity with no weekly title and no weekly description
- **WHEN** the lead enters only whitespace in both fields
- **THEN** Save is disabled, no pending edit is reported and the unload guard is not armed

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
