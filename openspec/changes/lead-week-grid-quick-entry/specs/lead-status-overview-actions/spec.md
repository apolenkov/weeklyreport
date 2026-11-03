## MODIFIED Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

Editable Lead Overview MUST create Current and Next items in an inline, owner- and week-specific composer, using canonical draft-save, authorization and lifecycle paths. Detailed editing MUST use the canonical item editor. Previously planned and ineligible sections remain read-only.

#### Scenario: A lead creates a Product update from Overview

- **WHEN** the lead activates Add item within an editable Product's selected week
- **THEN** an inline composer is bound to that Product and week
- **AND** saving uses existing draft patch, autosave, optimistic version, authorization and lifecycle paths
- **AND** the live Overview projection and autosave status reflect the change

#### Scenario: A lead creates an Activity update from Overview

- **WHEN** the lead activates Add item within an editable Activity's selected week
- **THEN** an inline composer is bound to that Activity with no Product-stage requirement
- **AND** saving uses the canonical draft and autosave path

#### Scenario: An Overview cell is not writable

- **WHEN** a cell is Previously planned or its section is submitted, locked, historical, or foreign
- **THEN** no Add or Edit action is rendered for that cell
- **AND** activating its content cannot emit a draft patch

## REMOVED Requirements

### Requirement: Overview create and edit MUST open in a dialog

**Reason**: The owner requested creation in the Current or Next grid context with inline entry, superseding header-only modal creation. Detailed editing continues to use the canonical dialog.

**Migration**: Replace the unit-header-only create entry with the week-specific inline entry. Preserve canonical modal editing, safe cancellation, failure recovery and the existing separate toolbar flows.

## ADDED Requirements

### Requirement: Overview creation is inline and details remain editable

On editable owned Products and Activities, Overview MUST offer item creation within Current and Next, including empty units, using an inline composer bound to that owner and week. Previously planned MUST offer no create action. Eligible existing items MUST retain detailed editing in the canonical dialog with safe dismissal and recovery.

#### Scenario: Create in the selected week

- **WHEN** a Lead opens the Next week add action for an editable Activity and submits valid input
- **THEN** a single Next item is saved under that Activity with Planned progress unless explicitly changed
- **AND** no Product parent is invented and the input is not written to the previous period

#### Scenario: Create fails or is cancelled

- **WHEN** required input is invalid, a save fails, or the Lead cancels a dirty inline composer
- **THEN** the interface preserves recoverable input or explicitly confirms discard, reports validation or failure, and does not claim an unsaved record exists
- **AND** a retry does not create a duplicate and keyboard focus remains meaningful

#### Scenario: Full edit and read-only records

- **WHEN** the Lead activates the edit-details control on an eligible Current or Next item
- **THEN** the canonical detailed editor opens for that item and preserves its dismissal and save-recovery protections
- **AND** frozen, submitted, foreign or otherwise ineligible records expose no mutation controls
