## Purpose

Ensure that both actions in the lead report Fill From split button remain easy to operate by touch on narrow viewports while retaining compact desktop toolbar geometry.

## ADDED Requirements

### Requirement: Lead report Fill From actions provide mobile-size touch targets

Every visible actionable segment of the lead report Fill From split button MUST have a rendered width and height of at least 44 px when the viewport is narrower than 48 rem. The same controls MUST retain the established compact toolbar geometry at desktop widths without changing their accessible names or behavior.

#### Scenario: Mobile lead uses the most recent submitted period

- **WHEN** a lead opens an editable report on a viewport narrower than 48 rem
- **THEN** the `Fill from most recent submitted period` button has a rendered width and height of at least 44 px
- **AND** activating it retains the existing Fill From behavior

#### Scenario: Mobile lead opens the past-period chooser

- **WHEN** a lead opens an editable report on a viewport narrower than 48 rem
- **THEN** the `Choose past report to fill from` button has a rendered width and height of at least 44 px
- **AND** activating it retains the existing menu behavior

#### Scenario: Desktop Fill From control remains compact

- **WHEN** a lead opens an editable report on a viewport at least 48 rem wide
- **THEN** both Fill From segments retain the established compact toolbar height
- **AND** their labels, order, and behavior are unchanged
