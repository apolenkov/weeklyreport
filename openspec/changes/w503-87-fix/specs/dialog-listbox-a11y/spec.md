# dialog-listbox-a11y Delta Specification

## MODIFIED Requirements

### Requirement: Search uses an input-owned keyboard selection model

The search combobox on Report History and Admin Products MUST retain input focus while Arrow keys select popup results. Tab MUST move to the next external focusable control without traversing result options and MUST dismiss the popup. Existing Enter selection, Escape clearing, result identity and viewer destination restrictions MUST remain intact.
When an error retry action is executed (via pointer click or keyboard activation), focus MUST be returned to the search input combobox rather than being dropped to document body.

#### Scenario: Tab leaves a search with results

- **GIVEN** the search input has focus and a populated result popup is open
- **WHEN** the user presses Tab
- **THEN** focus moves to the next external focusable control
- **AND** the result popup closes without navigation

#### Scenario: Arrow selection and Escape remain on the input

- **GIVEN** the search input has focus and multiple navigable results are visible
- **WHEN** the user moves the active result with ArrowDown or ArrowUp
- **THEN** focus remains on the input and its active descendant identifies the selected option
- **AND** Enter selects that result through the existing destination rules
- **WHEN** the search is reopened and Escape is pressed
- **THEN** the query clears and the result popup closes

#### Scenario: Retry button activation restores focus to search input

- **GIVEN** a search query has failed and the search popup displays "Search failed" with a "Try again" action button
- **WHEN** the user activates the "Try again" action via mouse click or keyboard
- **THEN** search retry is initiated
- **AND** focus is directed to the search combobox input rather than falling back to `<body>`
