## ADDED Requirements

### Requirement: The authorId deep-link scroll target matches the highlighted panel

The weekly-report page MUST resolve the `?authorId=<id>` deep-link scroll
target to the same product as the highlighted/expanded accordion panel.
Both MUST apply the same content filter — the scroll target MUST NOT be
derived from the author's raw first authored product without that filter,
since a filtered-out first product produces a scroll target that no visible
accordion panel satisfies.

#### Scenario: First authored product is empty, a later one has content

- **GIVEN** an `?authorId=<id>` deep-link where the author's first authored
  product has no content and a later authored product does
- **WHEN** the weekly-report page renders
- **THEN** the page scrolls into view the SAME product panel that is
  highlighted/expanded — the content-bearing one, not the empty first one

### Requirement: Activity-only draft sections count toward the draft-hidden signal

The weekly-report page's draft-hidden count and "Show all" affordance MUST
include sections whose only draft content is activity content (no draft
product content), under the default submitted-only filter. A section with
draft activity content but no draft product content MUST NOT be silently
excluded from the count just because the underlying product-content mapper
does not see it.

#### Scenario: A draft section has only activity content

- **GIVEN** a report section that is in draft state, with activity content
  but no product content
- **WHEN** the weekly-report page renders under the default submitted-only
  filter
- **THEN** the section counts toward the draft-hidden signal
- **AND** the "N in draft — Show all" affordance appears and, when
  activated, reveals that section
