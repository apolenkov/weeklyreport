## ADDED Requirements

### Requirement: The lead slide deck clamps an out-of-range selected index

The lead slide deck MUST keep `selectedIndex` within the bounds of the
current `slides` array: whenever the slide list shrinks (an active-period
rollover or a background refetch dropping own-section pages) below the
index the user was viewing, the deck MUST reset `selectedIndex` back to `0`
instead of rendering the "No slides available" empty state while valid
slides still exist at lower indexes.

#### Scenario: slide list shrinks below the current page

- **WHEN** a lead is viewing a non-zero slide index and a data refresh
  (period rollover or background refetch) shrinks `slides` so that index no
  longer exists
- **THEN** the deck resets `selectedIndex` to `0` and renders the first valid
  slide instead of the empty state

#### Scenario: slide list stays within range

- **WHEN** `slides` refreshes but still contains the currently selected index
- **THEN** `selectedIndex` is left unchanged and the same slide keeps
  rendering
