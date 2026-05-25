## ADDED Requirements

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
