## MODIFIED Requirements

### Requirement: The head deck navigates via a top carousel

The head status deck MUST present its slides as a horizontal carousel of slide cards above the active slide, NOT as a left sidebar list. The carousel MUST group its slides by the current scope (Product vs Leads) and MUST keep the deck navigable across all slides (selecting a carousel card, plus the existing arrow-key navigation). Selecting a carousel card MUST make that slide the active fullscreen slide. When a single section's slides span multiple paginated pages, each carousel card MUST have a key that is unique per page (id plus page index, not the slide id alone), so pagination never produces a React key collision.

#### Scenario: the head opens the deck with multiple slides

- **WHEN** the head views a report with two or more slides in the current scope
- **THEN** a horizontal carousel of slide cards renders above the active slide
- **AND** there is no left sidebar list
- **AND** selecting a carousel card or pressing the arrow keys changes the
  active slide

#### Scenario: scope drives the carousel slide set

- **WHEN** the head switches the scope between Product and Leads
- **THEN** the carousel re-groups its slide cards to match the selected scope
- **AND** the head still sees every lead's data; the data scope is unchanged by
  the navigation model

#### Scenario: a paginated section produces collision-free carousel keys

- **WHEN** one section's slides span more than one page (the same underlying
  `item.id` repeated across pages with a different page index)
- **THEN** the carousel renders one card per page
- **AND** no two cards share a React key

### Requirement: The active head slide keeps a visible fullscreen exit path

The active head slide MUST reuse the shared fullscreen affordance (`DeckFullscreenOverlay` exit pill and Esc hint) while rendering the same auto-height by-product article governed by `lead-slide-by-product-grid`. The head MUST NOT be trapped in fullscreen without a visible exit path, and arrow-key navigation across slides MUST be preserved. Fullscreen state MUST persist across a slide change triggered by arrow-key navigation or a carousel-card selection — the browser MUST NOT force-exit fullscreen as a side effect of navigating to a different slide.

#### Scenario: the head opens a slide

- **WHEN** the head selects a slide from the carousel
- **THEN** the active slide renders the shared by-product article
- **AND** a visible exit-fullscreen control returns the head to the standard
  view
- **AND** arrow-key navigation across slides remains available

#### Scenario: fullscreen survives arrow-key navigation

- **WHEN** the head is in fullscreen on one slide and presses ArrowRight or
  ArrowLeft to navigate to another slide
- **THEN** fullscreen remains active on the newly active slide
- **AND** the browser does not force-exit fullscreen as a result of the
  navigation
