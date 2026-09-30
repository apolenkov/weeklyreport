# lead-product-accordion-identity Specification

## Purpose

Give repeated lead-scope product accordions stable, accessible instance-local
identity and readable responsive content while preserving canonical product and lead navigation targets.

## Requirements

### Requirement: Repeated lead product accordions have instance-local identity

When lead scope renders the same product under multiple lead sections, every
accordion root, disclosure control, and disclosure region MUST have a unique,
stable DOM ID derived from both lead and product identity. Each control MUST
reference its own region with `aria-controls`, and each region MUST reference
its own controlling button with `aria-labelledby`, so its accessible name
matches the visible product and lead instance. Native button keyboard behavior
MUST remain available.

Product scope MUST retain the canonical `report-product-{productId}` root used
by product overview navigation. Lead overview navigation MUST retain the
canonical `report-lead-{leadId}` section target. Each product feedback anchor
MUST match its rendered instance root, leaving the product-scope value unchanged
while disambiguating repeated lead-scope cards.

#### Scenario: two leads contribute to the same product

- **GIVEN** lead scope renders one product under two contributing leads
- **WHEN** both accordion instances are inspected and toggled from the keyboard
- **THEN** every root, control, and region ID is unique
- **AND** each control and region reference only one another
- **AND** each region's accessible name resolves to its own lead's visible
  product header

#### Scenario: an author-linked product is highlighted in lead scope

- **GIVEN** a product appears under multiple leads
- **WHEN** an author link highlights that product for one contributing lead
- **THEN** only that lead's product instance is highlighted and expanded
- **AND** delayed scrolling targets that rendered instance through its local DOM
  ownership

#### Scenario: product and lead overview targets remain canonical

- **WHEN** product scope renders a product or lead scope renders a lead section
- **THEN** product scope exposes `report-product-{productId}`
- **AND** lead scope exposes `report-lead-{leadId}`

### Requirement: Shared product headers preserve readable identity at narrow widths

The shared product accordion header in
`apps/web/src/features/report-pages/ui/product/accordion-header.tsx` MUST
left-align product and lead identity. Below 640 CSS pixels, product and lead
names MUST wrap without ellipsis, and the status badge MUST occupy its own
line rather than compete with the product name. The disclosure control and
its instance-local accessible identity MUST remain intact.

#### Scenario: Similar long product names appear on mobile

- **WHEN** Head, Viewer, or Lead preview renders long product and lead names at 375 CSS pixels
- **THEN** the full names remain visible and left-aligned with the status on a separate line
- **AND** the disclosure control stays reachable without overlapping the text

### Requirement: Shared report rows keep prose readable beside metadata

The shared product rows under
`apps/web/src/features/report-pages/ui/product/` MUST stack metadata and record
prose below 640 CSS pixels, rather than reserve fixed side columns that compress
prose to a few characters. Stage and owner MUST precede record prose; status
MUST remain separately readable and accessible. Supplied Risk
impact and mitigation labels and values MUST also stack at that width. At
wider widths, the existing row grid MAY remain. Responsive changes MUST
preserve record text, status, links, disclosure behavior, and read-only boundaries.

#### Scenario: A mobile reader inspects a risk in preview

- **WHEN** Lead preview, Head, or Viewer renders a Risk with stage, impact, and mitigation at 375 CSS pixels
- **THEN** stage and owner precede the wrapping prose and supporting labels precede their values
- **AND** every supplied value and existing link remains available without changing the record
