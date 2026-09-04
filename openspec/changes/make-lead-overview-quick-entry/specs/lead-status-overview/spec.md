## MODIFIED Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

For an editable lead draft, Current week and Next week items MUST open the
existing item editor without leaving Overview. Every editable Current and Next
cell MUST also expose a contextual create action seeded to that reporting unit.
Saving an edit or creation MUST update the one canonical lead draft and MUST use
its existing `DraftPatch`, autosave, optimistic version, authorization, and
lifecycle paths. Previously planned MUST remain immutable. Submitted, locked,
historical, and foreign records MUST NOT expose an Overview write action.

#### Scenario: A lead creates a Product update from Overview

- **WHEN** the lead activates Add in an editable Product Current or Next cell
- **THEN** the existing item editor opens on the same page with that Product and week selected
- **AND** saving appends the item through the canonical week-items draft patch
- **AND** the live Overview projection and autosave status reflect the change

#### Scenario: A lead creates an Activity update from Overview

- **WHEN** the lead activates Add in an editable Activity Current or Next cell
- **THEN** the existing item editor opens with that Activity selected and no Product-stage requirement
- **AND** saving follows the same canonical draft and autosave path

#### Scenario: An Overview cell is not writable

- **WHEN** a cell is Previously planned or its section is submitted, locked, historical, or foreign
- **THEN** no Add or Edit action is rendered for that cell
- **AND** activating its content cannot emit a draft patch

### Requirement: Overview MUST group and identify reporting units clearly

Products and Project Activities MUST remain peer reporting-unit types in stable
Product-first order, with explicit group boundaries and counts. The visible
label of each unit MUST retain its complete identity at the accepted desktop
viewports; a status badge or metadata MUST NOT force the only name label into a
single-line ellipsis. Grouping MUST NOT duplicate Activity rows beneath linked
Products.

#### Scenario: Long Product and Activity names are rendered

- **WHEN** a reporting-unit name exceeds the first-column single-line width
- **THEN** the complete name remains visually readable through wrapping
- **AND** status and metadata remain associated with the same unit
- **AND** the document has no horizontal overflow

#### Scenario: Both reporting-unit types are present

- **WHEN** Overview contains Products and Project Activities
- **THEN** each type appears under one explicit labelled group with its real count
- **AND** every reporting unit appears exactly once in canonical order
