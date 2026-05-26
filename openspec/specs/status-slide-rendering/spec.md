# status-slide-rendering Specification

## Purpose

Define the density and layout invariants for the lead-role status slide
deck. Ensures that slide cards render at consistent tight density, that
decisions remain reachable via scroll when overflow occurs, and that the
user always has a discoverable fullscreen-exit path.

Consumer surfaces: `StatusSlideDeck`, `SummarySlide`, `DecisionSlide`
components in `apps/web/src/components/`.

## Requirements

### Requirement: Slide Card Density Tokens Are Consistent Across the Deck

The status slide deck MUST apply the same values for its three density
tokens — outer card padding, section-header line-height, and inter-slide
gap — across every slide card. Changing a density token MUST affect all
slide cards in the deck simultaneously; no individual card MUST silently
override the shared value.

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

### Requirement: Decisions Slide Must Constrain Vertical Overflow

The decisions section on the status slide deck MUST render inside a
scrollable container with a finite `max-height` so that arbitrarily many
decisions remain reachable. Content that exceeds the visible height MUST
become reachable via vertical scroll within the slide card; it MUST NOT
push subsequent slides off-screen or cause the deck container to grow
without bound.

#### Scenario: Slide renders fewer decisions than the container height

- **WHEN** a report period has 1-3 decisions
- **THEN** the decisions slide renders all of them without a scrollbar
- **AND** the slide card height matches its natural content

#### Scenario: Slide renders more decisions than the container height

- **WHEN** a report period has 10+ decisions that exceed the slide's `max-height`
- **THEN** the decisions section becomes vertically scrollable inside the slide
- **AND** all decisions remain reachable via scroll without leaving slide mode

### Requirement: Slide Deck Must Provide an Exit-Fullscreen Affordance

When the user enters the slide deck in fullscreen mode, the deck MUST
render a visible control (button, key hint, or icon) that returns the
user to the standard report view. The user MUST never be trapped in
fullscreen mode without a discoverable exit path.

#### Scenario: User enters fullscreen and looks for exit

- **WHEN** the user activates fullscreen on the slide deck
- **THEN** an exit-fullscreen control is rendered and visible on the slide chrome
- **AND** clicking or pressing the matching keyboard shortcut returns the user to the standard report view

### Requirement: Product Separators Must Share a Common Baseline

Product-group separators on the status slide view MUST render at a
consistent vertical baseline relative to each product group. The
baseline rule (top-aligned with the product title OR center-aligned
per group) MUST be applied uniformly across all groups so the eye
flow remains predictable.

#### Scenario: Slide renders three product groups

- **WHEN** the status slide view renders 3+ product groups in a single deck
- **THEN** each product separator appears at the same vertical offset relative to its product title
- **AND** no group's separator sits at a different baseline than the others

#### Scenario: One product group has more items than the others

- **WHEN** product A has 2 items and product B has 7 items on the same slide
- **THEN** the separator after product A still aligns with the separator after product B (according to the chosen baseline rule — e.g., both top-aligned with the next product title)
- **AND** the asymmetric item count does not push the separator into a different vertical position
