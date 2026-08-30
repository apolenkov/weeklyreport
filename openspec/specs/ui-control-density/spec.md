## Purpose

Define the current responsive control geometry used by the report interface.

## Requirements

### Requirement: Grouped controls share a consistent height

Interactive controls in one horizontal cluster MUST use one shared control
height token. Buttons, selects, inputs, and segmented controls MUST remain
keyboard-focusable and operable.

#### Scenario: a filter or action row renders

- **WHEN** a horizontal cluster contains mixed controls
- **THEN** every control uses the shared height
- **AND** every control remains keyboard-focusable and operable

### Requirement: SDLC connectors align with stage chips

At widths of 64 rem and above, each SDLC connector MUST be vertically centered
on the stage chip box. The chip and connector MUST use one shared height, stage
boxes MUST have equal compact widths, and the pipeline MUST remain on one row.
Connectors are decorative and MUST be excluded from the accessibility tree and
keyboard navigation.

Below 64 rem, the pipeline MUST use a four-column grid through 48 rem and a
two-column grid below 48 rem, without connector arrows, horizontal scrollers,
or root overflow. Stage controls MUST retain a 44 px touch target.

#### Scenario: stages show assignees

- **WHEN** stage chips include assignee labels at desktop width
- **THEN** the connector midline matches the chip midline
- **AND** assignee height does not shift either alignment

#### Scenario: a compact viewport renders the pipeline

- **WHEN** the viewport is narrower than 64 rem
- **THEN** stages use the prescribed grid and arrows are absent
- **AND** the page has no root horizontal overflow

### Requirement: Compact actions meet the touch target

Below 48 rem, report view-mode segments, the development role-switcher trigger
and menu items, and admin user-row actions MUST each measure at least 44 by 44
CSS pixels. The shared segmented-toggle track MUST preserve child focus
indicators and its compact desktop geometry.

#### Scenario: a phone user changes report view

- **WHEN** Edit and Slides segments are visible below 48 rem
- **THEN** each segment is at least 44 by 44 CSS pixels without root overflow

#### Scenario: a phone user operates a user row

- **WHEN** user-row actions are visible below 48 rem
- **THEN** every action is at least 44 by 44 CSS pixels
