## ADDED Requirements

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
opacity ≤ 300ms) when a timed-rotation strategy is chosen. The hero
container MUST reserve enough height for the longest tagline so a
rotation does NOT cause cumulative layout shift on the hero region.

#### Scenario: Timed rotation cycles to a longer tagline

- **WHEN** the rotation transitions from a short tagline to a longer one
- **THEN** the hero container height does NOT change
- **AND** the fade-in/fade-out transition runs smoothly (no flash of unstyled content)
