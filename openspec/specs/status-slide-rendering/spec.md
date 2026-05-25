# status-slide-rendering Specification

## Purpose

TBD - created by archiving change redesign-slide-density-v8-4-3. Update Purpose after archive.

## Requirements

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
