## Purpose

Define responsive control geometry, visible identity, and meaningful-text readability used by the report interface.

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

### Requirement: Meaningful interface text has a readable size and contrast

Meaningful visible text on interactive application screens in `apps/web/src`
and their shared interface components MUST have a computed font size of at
least 12 CSS pixels. This includes user and author identity, metadata, status
labels, counters, stage tags, and legends. The private print/PDF rendering
surface is outside this requirement's scope.
Ordinary meaningful text MUST have a contrast ratio of at least 4.5:1 against
its actual composed background; ancestor opacity and overlays MUST be included
in that measurement. Decorative marks and inactive controls are exempt, but
their persistent explanations MUST remain readable. Text enlargement MUST
NOT introduce clipping, overlapping content, or inaccessible controls.

#### Scenario: A reader inspects secondary report information

- **WHEN** report metadata, initials, status labels, or legends render at 375 or 1440 CSS pixels
- **THEN** meaningful text is at least 12 CSS pixels with at least 4.5:1 contrast
- **AND** no meaningful name is dimmed below the contrast floor merely because its section is empty

### Requirement: Authenticated navigation exposes the signed-in identity on mobile

The shared navigation under `apps/web/src/shared/ui/navigation/` MUST show the
signed-in user's existing display name and role at 375 CSS pixels. Long names
MUST wrap without pushing the Menu, development role-switcher, or Sign out
controls outside the viewport. Navigation actions MUST occupy the trailing
side of the mobile header and preserve their existing accessible names and
keyboard operation. Desktop navigation MUST retain its centered main links.

#### Scenario: Mobile navigation contains a long user name

- **WHEN** a signed-in visitor with a long display name opens an application page at 375 CSS pixels
- **THEN** the name and role remain visible and the navigation actions remain reachable at the right
- **AND** the existing named Menu and Sign out controls remain operable

### Requirement: Icon-only row actions are labelled and reach the touch target

Icon-only actions in table rows MUST expose an accessible name and tooltip that
identify the row, MUST use the foreground colour (not the muted tone) while
enabled so they do not read as disabled, and MUST grow to the shared
`--touch-target-min` size on coarse pointers.

#### Scenario: Periods table actions on a touch device

- **WHEN** the admin Periods table renders on a `pointer: coarse` device
- **THEN** each action button is at least `--touch-target-min` wide and tall
- **AND** each carries an `aria-label` and `title` naming the action and period
