## MODIFIED Requirements

### Requirement: Every content-bearing Period Summary row drills into the focused report

The head dashboard Period Summary queue MUST expose its current Open or Review action for every row with report content, whether the section is draft or submitted. The action MUST target that lead's focused live report. Open MUST retain the ordinary Read entry; Review MUST add explicit review intent and Leads scope. A row with no content MUST NOT expose an Open action.

#### Scenario: Draft content opens the focused live report

- **WHEN** a draft activity row has at least one item, risk, decision, or priority
- **THEN** the row links to `/head/report/[reportId]?authorId=[leadId]` without review intent
- **AND** its draft status remains visibly labeled

#### Scenario: Submitted content remains linked

- **WHEN** a submitted activity row has report content
- **THEN** its Open action retains the same focused live-report target without review intent
- **AND** its eligible Review action targets `/head/report/[reportId]?authorId=[leadId]&scope=lead&review=1`
- **AND** both expose the standard keyboard focus and link affordances

#### Scenario: Truly empty row is inert

- **WHEN** an activity row has zero items, risks, decisions, and priorities
- **THEN** the row renders no report link
- **AND** it communicates that the lead has no report content yet

#### Scenario: A submitted section is reviewable

- **WHEN** a content-bearing submitted row has current review capability in a non-published, non-archived period and Head activates Review
- **THEN** the focused report opens directly in eligible Review rather than requiring a second mode activation
- **AND** Request changes and Revoke remain distinct actions with their existing confirmation, reason and capability gates
