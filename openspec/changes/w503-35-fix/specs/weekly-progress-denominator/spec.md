## ADDED Requirements

### Requirement: Admin Periods progress groups section rows once

The Admin Periods tab SHALL compute each open period's `submittedCount` and `totalCount` from that period's own section rows, grouped in a single pass over the fetched section rows. Its cost SHALL grow with the number of open periods plus the number of section rows, not with their product. The figure for each period SHALL stay identical to the shared lead-based computation, including the deactivated-lead, duplicate-row and out-of-scope rules.

#### Scenario: Several open periods share one pass over their sections

- **GIVEN** three open periods, each with its own section rows, and a section row for a period that is not listed
- **WHEN** the Admin lists the periods
- **THEN** each row's `submittedCount` and `totalCount` equal the lead-based figure for that period's own sections, and the section rows are not rescanned once per period
