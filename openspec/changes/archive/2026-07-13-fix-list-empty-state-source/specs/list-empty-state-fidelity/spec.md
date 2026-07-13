## ADDED Requirements

### Requirement: A filterable list's header count and empty-state derive from the same rows the list renders

A filterable list surface MUST compute its header count and its empty-state
branch from the same filtered row set the list body maps over, never from the
unfiltered source. This applies whenever rows are filtered before rendering,
whether by client-side search, a hidden-row filter, or both. The surface MUST
distinguish "there is no data at all" from "there is data but nothing matches
the current filter" and MUST render a distinct message for each case.

#### Scenario: Search matches nothing

- **WHEN** a filterable list has rows but the current search text matches
  none of them
- **THEN** the header count reflects zero matching rows
- **AND** the body renders an explicit "no results for the search" message
  instead of a blank panel

#### Scenario: No data at all

- **WHEN** a filterable list has zero underlying rows and no search text is
  entered
- **THEN** the header count reads zero
- **AND** the body renders a "no data yet" message, distinct from the
  no-search-match message

#### Scenario: Hidden rows are excluded from both the count and the empty check

- **WHEN** a filterable list hides some rows unconditionally (for example
  internal proof/system rows never shown to the user) and every remaining row
  is filtered out or the page contains only hidden rows
- **THEN** the header count and the empty-state branch both key off the
  post-hide, post-search row set, not the raw unfiltered row set
