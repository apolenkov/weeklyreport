## ADDED Requirements

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
