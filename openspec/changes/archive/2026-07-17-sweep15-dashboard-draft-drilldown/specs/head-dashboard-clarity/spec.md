## ADDED Requirements

### Requirement: Every content-bearing live activity row drills into the focused report

The head dashboard `ActivityLivePanel` MUST render every row with report content as a link to that lead's focused live report, whether the section is draft or submitted, and MUST keep only zero-content rows inert.

#### Scenario: Draft content opens the focused live report

- **WHEN** a draft activity row has at least one item, risk, decision, or priority
- **THEN** the row links to `/head/report/[reportId]?authorId=[leadId]`
- **AND** its draft status remains visibly labeled

#### Scenario: Submitted content remains linked

- **WHEN** a submitted activity row has report content
- **THEN** the row links to the same focused live-report target
- **AND** it exposes the standard keyboard focus and link affordances

#### Scenario: Truly empty row is inert

- **WHEN** an activity row has zero items, risks, decisions, and priorities
- **THEN** the row renders no report link
- **AND** it communicates that the lead has no report content yet
