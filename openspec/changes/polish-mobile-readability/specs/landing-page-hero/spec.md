## ADDED Requirements

### Requirement: Sign-in context stays readable across viewport widths

The sign-in panel in `apps/web/src/app/login-page.client.tsx` MUST visibly label
the available development-role choices as sign-in options. Each role choice
MUST have a minimum height of 44 CSS pixels and readable 14 CSS pixel text.
The desktop organization caption MUST have a text contrast ratio of at least
4.5:1 against its composed hero background, including the gradient and static
overlays. Existing sign-in destinations and environment gates MUST remain unchanged.

#### Scenario: A visitor selects a development role

- **WHEN** development-role sign-in is available on the landing page
- **THEN** the role group has a visible sign-in label and readable role choices
- **AND** each choice meets its minimum height without clipping its name

#### Scenario: Desktop organization caption is visible

- **WHEN** the landing hero renders at 1440 CSS pixels
- **THEN** its organization caption has at least 4.5:1 contrast across the actual background behind the text

## MODIFIED Requirements

### Requirement: Hero Brand Wordmark Reads "Weekly Report"

The landing-page hero brand wordmark MUST read "Weekly Report" and MUST
NOT present a pulse/heartbeat brand ("Your PULSE" or equivalent). The
wordmark's accessible name (the `role="img"` `aria-label`) and the
page's single `<h1>` MUST both be the string "Weekly Report". Below 1024 CSS
pixels, the heading MUST be visible in the sign-in panel because the hero
wordmark is hidden. At wider widths, the heading MAY be screen-reader-only
while the hero wordmark remains visible.
The visible lettering MAY be split across two tiers (an eyebrow line
plus a display line) provided the combined reading is "Weekly Report".

#### Scenario: Cold visitor sees the hero brand

- **WHEN** an unauthenticated visitor loads the landing page
- **THEN** the hero brand mark reads "Weekly Report"
- **AND** no "Your PULSE" / heartbeat wordmark is present

#### Scenario: Mobile visitor sees the product name

- **WHEN** an unauthenticated visitor loads the landing page at 375 CSS pixels
- **THEN** the sign-in panel visibly identifies Weekly Report
- **AND** the page retains exactly one level-one heading

#### Scenario: Screen reader announces the brand

- **WHEN** assistive tech computes the accessible name of the hero brand image
- **THEN** the name is exactly "Weekly Report"
- **AND** the page exposes one level-one heading whose text is "Weekly Report"
