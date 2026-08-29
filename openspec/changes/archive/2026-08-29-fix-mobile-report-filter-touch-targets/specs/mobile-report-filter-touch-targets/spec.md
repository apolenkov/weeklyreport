## Purpose

Ensure that leads can reliably operate the report ownership filter by touch on narrow viewports while retaining the established compact desktop control.

## ADDED Requirements

### Requirement: Lead report ownership filter provides mobile-size targets

Every visible option in the lead report ownership filter MUST render at least 44 px wide and 44 px high when the viewport is narrower than 48 rem. Each option MUST retain its accessible name, selected state, and filtering behavior, while desktop widths retain the established compact geometry.

#### Scenario: Lead changes ownership scope on mobile

- **WHEN** a lead opens an editable report on a viewport narrower than 48 rem
- **THEN** each visible ownership-filter option has a rendered width and height of at least 44 px
- **AND** activating an option retains the existing filtering and selected-state behavior

#### Scenario: Desktop ownership filter remains compact

- **WHEN** a lead opens an editable report on a viewport at least 48 rem wide
- **THEN** the ownership-filter options retain the established compact desktop geometry
- **AND** their labels, order, and behavior are unchanged
