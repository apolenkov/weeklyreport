# mobile-navigation-touch-targets Specification

## Purpose

Ensure that signed-in navigation controls remain easy to operate by touch on narrow viewports without sacrificing the compact desktop header.

## Requirements

### Requirement: Signed-in navigation rail provides mobile-size touch targets

Every visible button in the signed-in top-navigation right rail MUST have a rendered width and height of at least 44 px when the viewport is below the mobile breakpoint. This contract applies to actionable controls such as Sign out and inert deferred controls such as Theme and Language. The same controls MUST retain the established compact geometry at desktop widths.

#### Scenario: Mobile user operates navigation rail controls

- **WHEN** a signed-in user opens any product route on a viewport narrower than 48 rem
- **THEN** each visible right-rail button has a rendered width and height of at least 44 px
- **AND** each control retains its existing accessible name and behavior

#### Scenario: Desktop navigation remains compact

- **WHEN** a signed-in user opens a product route on a viewport at least 48 rem wide
- **THEN** the right-rail controls use the established compact desktop height
- **AND** the navigation information architecture and control order are unchanged

### Requirement: Navigation loading geometry matches the resolved control geometry

The signed-in navigation loading placeholders MUST reserve the same responsive height and minimum width as the controls they replace, so session hydration does not introduce a geometry shift.

#### Scenario: Session state hydrates on a mobile viewport

- **WHEN** the navigation renders loading placeholders before the signed-in session resolves on a viewport narrower than 48 rem
- **THEN** each placeholder reserves at least 44 px in both dimensions
- **AND** replacing the placeholders with the right-rail controls does not change the rail's target geometry
