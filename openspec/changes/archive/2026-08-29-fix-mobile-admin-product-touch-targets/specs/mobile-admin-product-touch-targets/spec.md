## Purpose

Ensure that administrators can reliably expand, edit, and archive product rows by touch on narrow viewports while retaining the established compact desktop table.

## ADDED Requirements

### Requirement: Admin product-row controls provide mobile-size targets

Every visible stage-assignment disclosure, Edit, and Archive control in the admin Products tab MUST render at least 44 px wide and 44 px high when the viewport is narrower than 48 rem. Each control MUST retain its accessible name, state, and behavior.

#### Scenario: Administrator operates a product row on mobile

- **WHEN** an administrator opens the Products tab on a viewport narrower than 48 rem
- **THEN** every visible stage-disclosure, Edit, and Archive control has a rendered width and height of at least 44 px
- **AND** activating each control retains its existing expanded state, dialog, mutation, and disabled behavior

#### Scenario: Repeated product controls fit the mobile viewport

- **WHEN** the Products tab renders multiple product rows on a viewport narrower than 48 rem
- **THEN** enlarging the repeated controls does not create document-level horizontal overflow
- **AND** each product row's name and visible actions remain reachable

#### Scenario: Desktop product table remains compact

- **WHEN** an administrator opens the Products tab on a viewport at least 48 rem wide
- **THEN** product-row controls retain the established compact desktop geometry
- **AND** their labels, order, and behavior are unchanged
