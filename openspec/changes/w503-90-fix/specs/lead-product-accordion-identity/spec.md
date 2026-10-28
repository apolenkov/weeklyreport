# lead-product-accordion-identity Specification Changes

## MODIFIED Requirements

### Requirement: Shared product headers preserve readable identity at narrow widths

The shared product accordion header in
`apps/web/src/features/report-pages/ui/product/accordion-header.tsx` MUST
left-align product and lead identity. Below 640 CSS pixels, product and lead
names MUST wrap without ellipsis, and the status badge MUST occupy its own
line rather than compete with the product name. The disclosure control and
its instance-local accessible identity MUST remain intact.
The interactive disclosure button MUST contain only valid phrasing content and MUST NOT contain `div` descendants.

#### Scenario: Similar long product names appear on mobile

- **WHEN** Head, Viewer, or Lead preview renders long product and lead names at 375 CSS pixels
- **THEN** the full names remain visible and left-aligned with the status on a separate line
- **AND** the disclosure control stays reachable without overlapping the text

#### Scenario: Accordion header button contains only phrasing content

- **WHEN** the accordion header disclosure button is inspected in the DOM
- **THEN** the button element contains zero `div` descendants
- **AND** all identity, avatar, status, and chevron elements are rendered as valid phrasing elements
