## ADDED Requirements

### Requirement: Unmatched emphasis markers remain literal

A schema-valid answer string with an unmatched trailing `**` MUST preserve that marker and trailing text literally without making that tail strong. Closed pairs MUST retain emphasis and escaped rendering; unsupported Markdown grammar MUST NOT be enabled by this repair.

#### Scenario: An answer has an unmatched tail

- **WHEN** Chat receives `a **b`
- **THEN** its answer paragraph displays `a **b` and contains no strong tail

#### Scenario: Balanced pairs precede an unmatched marker

- **WHEN** Chat receives `**one** and **two** then **tail`
- **THEN** only one and two are strong and the trailing `**tail` remains literal
