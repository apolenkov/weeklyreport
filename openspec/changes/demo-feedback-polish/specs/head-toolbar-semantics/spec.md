## ADDED Requirements

### Requirement: The view-mode toggle reflects the active mode and view state persists in the URL

The view-mode toggle MUST highlight the segment that matches the current view
(Edit vs Slides), so the active segment always reflects the on-screen mode. The
toggle MUST receive the real current mode, not a hard-coded default. In addition,
the head report view state — the view mode, the scope (Product / Leads), and the
show-archived filter — MUST be encoded in the URL so that navigation, a page
refresh, and a shared link all preserve the selection.

#### Scenario: the deck is on screen

- **WHEN** the head is viewing the slide deck (`?mode=slides`)
- **THEN** the Slides segment is highlighted as active
- **AND** the Edit segment is not highlighted

#### Scenario: refresh preserves the view state

- **WHEN** the head selects a scope, the slides mode, and the show-archived
  filter, then refreshes the page or opens the shared URL
- **THEN** the same mode, scope, and show-archived filter are restored from the URL
- **AND** the active toggle segment matches the restored mode
