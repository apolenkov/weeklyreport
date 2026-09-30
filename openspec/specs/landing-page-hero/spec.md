# Landing Page Hero

## Purpose

Define the tagline rotation and animation invariants for the landing-page
hero section. Ensures the hero displays a curated tagline array rather
than a hardcoded string, and that rotation transitions do not produce
layout shift.

Consumer surfaces: `TaglineCycler` in
`apps/web/src/features/landing/ui/tagline-cycler.tsx`,
`LANDING_TAGLINES` constant in
`apps/web/src/features/landing/ui/landing-page.constants.ts`.

## Requirements

### Requirement: Landing Hero Displays a Tagline from a Curated Set

The landing-page hero section MUST display its tagline from a curated
array of 4–6 product taglines, not from a single hardcoded string. The
rotation strategy (random-on-load OR timed interval ≥ 1.5s) is a free
choice, but the displayed text MUST come from the curated array.

#### Scenario: Cold visitor loads the landing page

- **WHEN** an unauthenticated visitor first loads the landing page
- **THEN** the hero renders exactly one tagline from the curated array
- **AND** the rendered tagline string is one of the array entries (no hardcoded fallback)

#### Scenario: Tagline array is empty (defensive)

- **WHEN** the curated array is misconfigured to length 0
- **THEN** the hero either renders a deterministic placeholder or omits the tagline element entirely
- **AND** the page does NOT throw a runtime error

### Requirement: Tagline Rotation Animates Without Layout Shift

Transitions between taglines MUST use a fade-in/fade-out animation (CSS
opacity ≤ 300ms) when a timed-rotation strategy is chosen and the visitor has
not requested reduced motion. With prefers-reduced-motion: reduce, the tagline
MUST remain readable throughout rotation without the opacity fade. The hero
container MUST reserve enough height for the longest tagline so a
rotation does NOT cause cumulative layout shift on the hero region.

#### Scenario: Timed rotation cycles to a longer tagline

- **WHEN** the rotation transitions from a short tagline to a longer one
- **THEN** the hero container height does NOT change
- **AND** the fade-in/fade-out transition runs smoothly (no flash of unstyled content)

#### Scenario: Visitor requests reduced motion

- **WHEN** the browser reports prefers-reduced-motion: reduce during rotation
- **THEN** the tagline remains opaque and has no opacity transition
- **AND** its text and reserved layout remain readable and stable

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

#### Scenario: The stylesheet defines no pulse motion

- **WHEN** the landing stylesheet is inspected
- **THEN** it defines no keyframes for the heartbeat sweep or wordmark breathing
- **AND** no element references heartbeat or wordmark-breathing animations

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
