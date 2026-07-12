## ADDED Requirements

### Requirement: getLiveActivity has regression coverage for its logic-bearing branches

`getLiveActivity` MUST have regression test coverage for its three
logic-bearing branches: a lead with no `ReportSection` for the current
report, the draft-before-submitted sort order across leads, and the
multi-source `lastEditAt` maximum across a lead's items, risks, decisions,
and comments. A test suite that only asserts `reportId`, `rows.length`, and
`leadId` on fixtures where every lead already has a section MUST NOT be
considered sufficient coverage for this method.

#### Scenario: a lead with no section reads as draft with zero activity

- **GIVEN** a lead in the caller's reporting group with no `ReportSection`
  row for the current report
- **WHEN** `getLiveActivity` runs for that group
- **THEN** the lead's row has `status: "draft"`, `itemCount: 0`, and
  `lastEditAt: null`

#### Scenario: draft-status leads sort before submitted-status leads

- **GIVEN** one lead with a `status: "draft"` section and another lead with
  a `status: "submitted"` section, both in the caller's group
- **WHEN** `getLiveActivity` runs for that group
- **THEN** the draft-status lead's row appears before the submitted-status
  lead's row in the result, regardless of each section's own
  `updatedAt`

#### Scenario: lastEditAt reflects the latest record across sources

- **GIVEN** a lead's section with an `Item`, a `Risk`, a `Decision`, and a
  `RecordComment` carrying distinct timestamps
- **WHEN** `getLiveActivity` computes that lead's row
- **THEN** `lastEditAt` equals the maximum timestamp across all of those
  records, not merely the section's own `updatedAt`
