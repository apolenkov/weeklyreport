## ADDED Requirements

### Requirement: Search uses an input-owned keyboard selection model

The search combobox on Report History and Admin Products MUST retain input focus while Arrow keys select popup results. Tab MUST move to the next external focusable control without traversing result options and MUST dismiss the popup. Existing Enter selection, Escape clearing, result identity and viewer destination restrictions MUST remain intact.

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

### Requirement: The active search result remains visible

The search popup MUST reveal the active result during input-owned keyboard navigation when results exceed its visible height. Revealing a result MUST scroll the popup without displacing the document or changing selection and navigation identity.

#### Scenario: Arrow navigation reaches a result below the popup viewport

- **GIVEN** a populated search popup whose results exceed its visible height
- **WHEN** ArrowDown selects a result below the current popup viewport
- **THEN** the active result is visible within the popup viewport
- **AND** focus remains on the input and document scroll is unchanged
