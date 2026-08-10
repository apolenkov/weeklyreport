## ADDED Requirements

### Requirement: The lead toolbar preserves compact desktop grouping

The lead report context toolbar MUST keep its period controls compact at desktop widths. The period navigator MUST consume only the width required by its controls; it MUST NOT grow across the remaining row and push the archive filter into an isolated center position. Full-row growth is allowed only when required for compact responsive reflow.

#### Scenario: archive filter is visible on desktop

- **WHEN** the lead toolbar renders period navigation and the archive filter on a wide viewport
- **THEN** the archive filter reads as part of the period cluster rather than as a centered standalone action

#### Scenario: period controls need a full compact row

- **WHEN** the viewport is too narrow for both context clusters
- **THEN** the period controls MAY take a full row while keeping the period selector usable and the archive filter adjacent
