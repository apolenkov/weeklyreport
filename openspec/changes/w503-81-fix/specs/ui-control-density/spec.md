# Spec Delta

## MODIFIED Requirements

### Requirement: Authenticated navigation exposes the signed-in identity on mobile

The shared navigation under `apps/web/src/shared/ui/navigation/` MUST show the
signed-in user's existing display name and role at 375 CSS pixels. Long names
MUST wrap without pushing the Menu, development role-switcher, or Sign out
controls outside the viewport. Navigation actions MUST occupy the trailing
side of the mobile header and preserve their existing accessible names and
keyboard operation. The Menu trigger MUST sit inside that header rail as a
44 CSS pixel icon control named "Open navigation menu", not as a separate row
below the header, and its panel MUST open from the trailing edge. Desktop
navigation MUST retain its centered main links. The sheet header MUST provide
sufficient trailing clearance (such as right padding) for the close button so
that header titles do not underlap the close control.

#### Scenario: Mobile navigation contains a long user name

- **WHEN** a signed-in visitor with a long display name opens an application page at 375 CSS pixels
- **THEN** the name and role remain visible and the navigation actions remain reachable at the right
- **AND** the existing named Menu and Sign out controls remain operable

#### Scenario: Mobile navigation sheet header does not underlap close button

- **WHEN** the mobile navigation menu opens on a 375 CSS pixel viewport
- **THEN** the header text content remains clear of the absolute close button bounds
