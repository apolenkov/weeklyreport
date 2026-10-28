# period-fill-from-ui Delta Specification

## ADDED Requirements

### Requirement: The dropdown panel stays bounded within the viewport

`FillFromDropdownPanel` MUST remain positioned within viewport bounds and not overflow below the screen on low or zoomed viewports. When viewport height does not provide sufficient clearance below the trigger, the panel MUST clamp its `maxHeight` and/or position above the trigger so that all available controls and list items remain accessible within the viewport.

#### Scenario: Fill From dropdown open on a low-height viewport

- **GIVEN** the Fill From trigger is open on a screen with low viewport height (such as 1280×300 or 1280×200)
- **WHEN** the "Past reports" panel renders
- **THEN** the panel's bottom edge does not extend past the viewport boundary
- **AND** the panel remains scrollable with its contents accessible within viewport boundaries
