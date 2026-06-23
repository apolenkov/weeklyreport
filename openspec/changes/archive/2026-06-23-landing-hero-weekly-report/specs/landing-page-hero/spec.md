# Landing Page Hero

## ADDED Requirements

### Requirement: Hero Brand Wordmark Reads "Weekly Report"

The landing-page hero brand wordmark MUST read "Weekly Report" and MUST
NOT present a pulse/heartbeat brand ("Your PULSE" or equivalent). The
wordmark's accessible name (the `role="img"` `aria-label`) and the
page's single `sr-only` `<h1>` MUST both be the string "Weekly Report".
The visible lettering MAY be split across two tiers (an eyebrow line
plus a display line) provided the combined reading is "Weekly Report".

#### Scenario: Cold visitor sees the hero brand

- **WHEN** an unauthenticated visitor loads the landing page
- **THEN** the hero brand mark reads "Weekly Report"
- **AND** no "Your PULSE" / heartbeat wordmark is present

#### Scenario: Screen reader announces the brand

- **WHEN** assistive tech computes the accessible name of the hero brand image
- **THEN** the name is exactly "Weekly Report"
- **AND** the page exposes one level-one heading whose text is "Weekly Report"

### Requirement: Hero Has No Decorative Pulse Motion

The landing-page hero MUST NOT render a decorative pulse/heartbeat
animation: no animated ECG/heartbeat trace and no breathing-weight
animation on the brand wordmark. The brand wordmark MUST render static.
A static background (gradient base, dot grid, hairline) is permitted.
This requirement does NOT govern the tagline fade transition, which
remains covered by the "Tagline Rotation Animates Without Layout Shift"
requirement.

#### Scenario: Hero renders with motion enabled

- **WHEN** a visitor with no reduced-motion preference loads the landing page
- **THEN** the hero shows no animated ECG/heartbeat trace
- **AND** the brand wordmark does not animate its weight or position

#### Scenario: Dead pulse motion is removed, not merely paused

- **WHEN** the landing stylesheet is inspected
- **THEN** it defines no keyframes for the heartbeat sweep or wordmark breathing
- **AND** no element references those removed animations
