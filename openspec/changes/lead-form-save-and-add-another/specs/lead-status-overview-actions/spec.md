# Spec Delta: lead-status-overview-actions

## MODIFIED Requirements

### Requirement: Overview contextual creation MUST seed Current or Next through one composer

Editable Overview Current/Next cells MUST offer contextual `+` creation seeded to unit and week, visible on hover/focus and always on touch. When mobile empty lanes are collapsed, equivalent Current/Next controls MUST live in the unit header. These controls MUST supplement header Add item and share its composer. Direct Next creation MUST start with editable Planned progress.

The item creation composer and dialog MUST offer a "Save and add another" action (accessible via button and keyboard shortcut `Ctrl+Shift+Enter` / `Cmd+Shift+Enter`). In create mode, activating "Save and add another" MUST validate and submit the item via the canonical draft save path. Upon successful save, the composer MUST remain open seeded to the same reporting unit, section, and week with cleared text fields and focus returned to the description field. If save fails or validation fails, entered input MUST be preserved and the composer MUST NOT be cleared. In edit mode, "Save and add another" MUST NOT be rendered.

#### Scenario: Contextual creation is reachable without hover

- **WHEN** the lead focuses an eligible Current/Next create control or uses a touch device
- **THEN** that control is visible and operable without hover
- **AND** its accessible name identifies creation, unit, and week
- **AND** pointer hover reveals the same cell action on desktop

#### Scenario: A new item is created directly in Next

- **WHEN** the lead activates the Next contextual `+`
- **THEN** one composer opens with that unit, Next, and Planned selected
- **AND** the lead can change progress before saving
- **AND** saving unchanged defaults emits one Next item with `workflowStatus=planned`, without rewriting an existing item's progress

#### Scenario: An empty Next lane has a mobile creation target

- **WHEN** empty lanes are collapsed on mobile, including an entirely empty unit
- **THEN** the unit header contains always-visible touch controls for Current and Next creation, labelled with unit and week
- **AND** Next creation is available without mounting a hidden-lane composer or first opening a Current composer
- **AND** the general header Add item action remains and no Previous create action is offered

#### Scenario: Save and add another successfully saves and prepares a new item

- **WHEN** the lead enters a valid item in the Overview composer and activates "Save and add another" (or presses Ctrl+Shift+Enter / Cmd+Shift+Enter)
- **THEN** the item is submitted to the canonical draft save path
- **AND** upon save completion, the composer remains open for the same reporting unit and week
- **AND** description and next step fields are empty
- **AND** keyboard focus is placed into the description field

#### Scenario: Save and add another validation failure retains input

- **WHEN** the lead activates "Save and add another" while required fields are missing or invalid
- **THEN** client validation blocks the submission and displays field errors
- **AND** the typed input is preserved in the composer
- **AND** the composer does not reset or close

#### Scenario: Save and add another failure during persistence retains input

- **WHEN** "Save and add another" submits a valid item but server draft save encounters an error
- **THEN** the editor displays the save failure message
- **AND** the typed input is retained in the composer for retry

#### Scenario: Edit mode does not expose Save and add another

- **WHEN** the lead opens an existing item in edit mode
- **THEN** "Save and add another" is not rendered
- **AND** `Ctrl+Shift+Enter` does not trigger batch creation
