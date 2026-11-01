# portfolio-content-presence Specification

## Purpose

Keep portfolio navigation enabled for products with meaningful detailed
content, including decisions, priorities, and Needs Attention text.

## Requirements

### Requirement: Portfolio navigation follows detailed product content

The weekly-report portfolio overview SHALL treat a product as having content
when the detailed product contains a current item, next item, risk, decision,
priority, or non-blank Needs Attention text. Displayed item and risk counters
MUST NOT act as a narrower substitute for this content-presence contract. Status
badge glyphs MUST be decorative and hidden from assistive technology so they do
not pollute the button accessible name.

#### Scenario: Decision-only product remains navigable

- **WHEN** a product has one decision and no current items, next items, or risks
- **THEN** its portfolio card is not labeled `No updates`
- **AND** the card is enabled
- **AND** selecting the card navigates to its mounted detailed product section

#### Scenario: Truly empty product remains muted

- **WHEN** a product has no items, risks, decisions, priorities, or Needs Attention text
- **THEN** its portfolio card is labeled `No updates`
- **AND** the card remains disabled

#### Scenario: Decorative status glyph is hidden from assistive technology

- **WHEN** a portfolio overview card (`LeadOverviewCard` or `ProductOverviewCard`) renders a status badge
- **THEN** the badge element has `aria-hidden="true"` so the decorative symbol is omitted from the button accessible name
- **AND** the textual status label or `No updates` remains available in the accessible name
