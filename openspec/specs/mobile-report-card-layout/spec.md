# mobile-report-card-layout Specification

## Purpose

Ensure that lead report item cards remain fully readable and operable inside current-week and next-week boards on narrow viewports without changing their desktop presentation.

## Requirements

### Requirement: Mobile lead report item cards fit their board containers

On the lead report route, every visible current-week and next-week item card MUST fit within its board container when the viewport is narrower than 48 rem. Product names, status metadata, item text, and visible actions MUST NOT be clipped by nested horizontal scrolling.

#### Scenario: Lead reviews item cards on a mobile viewport

- **WHEN** a lead opens an editable report on a viewport narrower than 48 rem
- **THEN** each current-week and next-week board has no horizontal scroll offset or horizontal overflow
- **AND** every visible item card's product name, status metadata, text, and actions remain within the board's visible width

#### Scenario: Lead returns from an item dialog

- **WHEN** a lead opens and then closes an item dialog on a viewport narrower than 48 rem
- **THEN** the containing current-week or next-week board remains at horizontal scroll offset zero
- **AND** its content width does not exceed its visible width

### Requirement: Mobile item actions remain accessible after reflow

Every visible actionable item-card control MUST retain its existing accessible name and behavior and MUST render at least 44 px wide and 44 px high on a viewport narrower than 48 rem. The system MUST NOT hide actions or clip them solely to suppress horizontal overflow.

#### Scenario: Lead operates reflowed item actions

- **WHEN** a lead views an item card on a viewport narrower than 48 rem
- **THEN** all actions available for that item's state remain visible and operable
- **AND** each visible action has a rendered width and height of at least 44 px

#### Scenario: Desktop item-card layout remains stable

- **WHEN** a lead opens the report on a viewport at least 48 rem wide
- **THEN** item-card metadata and actions retain the established desktop layout and density
- **AND** their labels, order, and behavior are unchanged
