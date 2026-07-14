## ADDED Requirements

### Requirement: The viewer's period navigator reflects the addressed period, not the newest

The `PeriodNavigator` rendered on the viewer's read-only report surface (`/reports/[reportId]`) MUST resolve its selected/current period from the addressed `reportId`, not from parsing the URL pathname against a route-scheme regex that does not cover the viewer's route shape. When the navigator is given the addressed period id directly, that id MUST take precedence for the trigger label, the listbox's highlighted option, and the Prev/Next targets.

#### Scenario: Viewer opens an older period via History

- **GIVEN** a viewer with 2+ published periods in an accessible group opens
  a period that is not the newest
- **WHEN** the read-only report surface renders its period navigator
- **THEN** the trigger label and listbox highlight match the opened period
- **AND** Prev/Next navigate relative to the opened period, not the newest
  one

#### Scenario: Explicit dropdown selection is unaffected

- **GIVEN** the viewer's period navigator
- **WHEN** the viewer picks a period directly from the listbox
- **THEN** navigation lands on the picked period, exactly as before this
  change
