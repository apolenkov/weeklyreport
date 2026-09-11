# lead-product-accordion-identity Specification

## Purpose

Give repeated lead-scope product accordions stable, accessible instance-local
identity while preserving canonical product and lead navigation targets.

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
