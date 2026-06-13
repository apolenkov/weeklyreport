## ADDED Requirements

### Requirement: Product chips scope the slide and content refills the frame

The product chip strip MUST act as a filter on the lead slide article
(`LeadSlideArticle`,
`apps/web/src/components/slides/status-slide-deck.tsx`): selecting a
chip scopes the unified quadrant slide to that product's rows, and
re-selecting the active chip restores all products. The selection MUST reset when the visible
slide page changes. While a product is selected, rows from the
`cross-product` pseudo-entry MUST NOT render. The chip strip's
`aria-selected` state MUST reflect the actual selection.

#### Scenario: a product chip is picked

- **WHEN** the lead slide aggregates two or more real products and one
  chip is clicked
- **THEN** the four quadrants render only that product's rows (empty
  quadrants keep their dashed placeholders)
- **AND** the picked chip is the only chip with `aria-selected="true"`

#### Scenario: the active chip is clicked again

- **WHEN** the currently selected product chip is clicked
- **THEN** the slide returns to the all-products view

#### Scenario: the slide page changes while a product is picked

- **WHEN** the user navigates to another slide page with a product
  selected
- **THEN** the new page renders unfiltered

### Requirement: The framed lead slide fills its frame on any content change

Inside the fixed-aspect `.slide-frame`, the quadrant grid MUST size
from the frame, not the viewport: hero and chip strip keep natural
height and the grid stretches over the remaining frame height, with
quadrants distributed evenly (`auto-rows-fr` semantics) and the named
`--slide-quadrant-min` per-quadrant floor preserved. Any content
change — picking or unpicking a product, adding a theme/item — MUST
redistribute the quadrants across the full frame; the slide MUST NOT
show a large empty band below the grid while the frame has unused
height.

#### Scenario: a sparse product is picked

- **WHEN** the picked product leaves only a few rows on the slide
- **THEN** the quadrant grid still spans the remaining frame height
- **AND** no dead bottom band appears inside the frame

#### Scenario: a theme is added to the section

- **WHEN** the section gains a new item and the slide re-renders
- **THEN** the quadrants redistribute evenly over the same frame
  height, identical in mechanism to the product-pick case
