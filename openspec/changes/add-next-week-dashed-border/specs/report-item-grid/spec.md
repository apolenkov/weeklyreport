## ADDED Requirements

### Requirement: Next-Week Item Cells Render with a Dashed Border

Item rows on the lead report grid MUST render with a border style that
distinguishes next-week items from current-week items at a glance.
Current-week items keep the existing solid border. Next-week items MUST
use a dashed border. The distinction MUST be visible without relying on
color (so it remains usable for color-deficient users).

#### Scenario: Grid renders mixed current-week and next-week items

- **WHEN** the lead report grid renders rows containing both current-week and next-week items
- **THEN** every current-week row uses a solid border
- **AND** every next-week row uses a dashed border
- **AND** no row mixes the two styles

#### Scenario: Grid renders only current-week items

- **WHEN** the report period has no next-week items
- **THEN** all visible rows render with the solid (current-week) border style
- **AND** no dashed border appears anywhere in the grid
