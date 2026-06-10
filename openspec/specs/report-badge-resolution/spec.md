## Purpose

Fixed by `fix-product-name-resolution` (2026-06-10): weekly-report risk and
decision badges rendered "Unknown" for products the report could name,
because resolution was scoped to the owning section's projects. This
capability fixes the durable property that badge product names resolve
report-wide. It governs name resolution, not a code module.

## Requirements

### Requirement: Badge product names resolve report-wide

Product names rendered on weekly-report badges (risks, decisions) MUST be
resolved from a report-wide projectId→productName map covering every
section's projects and the portfolio overview. A placeholder name MUST
appear only when the referenced project id is absent from the entire
report read model — never for a product another section or the portfolio
overview can name.

#### Scenario: a risk references a project outside its author's section

- **WHEN** a section's risk (or decision) references a projectId that is
  not in that section's own projects list but is named elsewhere in the
  report
- **THEN** the badge shows the real product name
- **AND** the "Unknown" placeholder appears only for ids the whole report
  cannot name
