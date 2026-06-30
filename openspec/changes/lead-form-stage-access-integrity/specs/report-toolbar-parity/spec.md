## ADDED Requirements

### Requirement: The Lead Report Defaults to Mine-Only Record Visibility

The lead report SHALL default its record visibility to **Mine only** for each
reporting period, hiding co-owners' records until the lead explicitly switches the
existing Mine/Everyone toggle to Everyone.

The default MUST be keyed per `{userId, reportId}` so each weekly report opens in
Mine-only regardless of the lead's choice on a prior period. The existing
`RecordVisibilityToggle` (Mine / Everyone) MUST remain the single control for this
axis — no second "show all" button is added; product health colour stays honest in
Mine-only (per the existing Product-context rule). Foreign records are not fetched in
the default state.

#### Scenario: A fresh period opens in Mine-only

- **GIVEN** a lead who co-owns a product with another lead
- **WHEN** the lead opens their report for a new period
- **THEN** only the lead's own records are shown
- **AND** co-owners' records are hidden until the lead switches the toggle to Everyone

#### Scenario: The toggle is the only show-all control

- **GIVEN** the lead report toolbar
- **WHEN** it renders
- **THEN** the Mine/Everyone toggle is present as the single record-visibility control
- **AND** no separate "show all" button duplicates that axis
