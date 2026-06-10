## ADDED Requirements

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
