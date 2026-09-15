## Purpose

Allow a lead to describe an Activity for a particular report week without changing the shared catalogue or another report's published presentation.

## ADDED Requirements

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
