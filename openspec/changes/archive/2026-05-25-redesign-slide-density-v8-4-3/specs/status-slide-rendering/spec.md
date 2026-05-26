## ADDED Requirements

### Requirement: Slide Card Density Tokens Are Centralized

The status slide deck MUST source its three density tokens — outer card
padding, section-header line-height, and inter-slide gap — from a single
constant or Tailwind utility set, not from per-component literals. A
future density tweak MUST be a single-source change, not a sweep across
multiple components.

#### Scenario: Designer tightens slide padding

- **WHEN** a contributor changes the slide outer-padding token from `p-3` to `p-2`
- **THEN** every slide card in the deck (status, summary, decision) reflects the new padding
- **AND** no per-component override silently retains the old value

### Requirement: Slide Cards Use Tight Density Defaults

The default density for the lead-role status slide deck MUST be:

- outer card padding ≤ `12px` (Tailwind `p-3` or tighter),
- section-header `line-height` ≤ `1.4`,
- inter-slide gap ≤ `12px` (Tailwind `gap-3` or tighter).

These defaults MUST hold for `StatusSlideDeck`, `SummarySlide`, and
`DecisionSlide`. The head-role report slides view is out of scope for
this requirement.

#### Scenario: Lead opens the status slide deck

- **WHEN** a lead opens their report in slide-deck mode
- **THEN** outer card padding renders at ≤ 12px
- **AND** section headers render with `line-height` ≤ 1.4
- **AND** gap between consecutive slides renders at ≤ 12px

#### Scenario: Head opens the same report in slide mode

- **WHEN** a head opens the report in slide-deck mode
- **THEN** the head-role density rules apply (unchanged by this requirement)
- **AND** lead-role density tokens are not used in the head view
