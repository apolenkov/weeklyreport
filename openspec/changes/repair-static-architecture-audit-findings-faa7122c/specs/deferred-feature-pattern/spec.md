## MODIFIED Requirements

### Requirement: Agent-Review Placeholder Covers Every On-Screen Report Surface

The agent-review deferred placeholder MUST render exactly once on every
on-screen surface that shows assembled report content, so coverage is consistent
across slides, the published viewer, presentation views, the lead self-preview,
and the Head report shell. The placeholder MUST be the
`AgentReviewComingSoon` component wrapping a `ComingSoonBadge`, and MUST NOT be
hidden behind a runtime feature flag.

#### Scenario: Published report viewer shows the placeholder

- **WHEN** a viewer or head opens `/reports/[reportId]` to read an assembled report
- **THEN** the published-viewer header renders one `AgentReviewComingSoon`
  control with its coming-soon tooltip

#### Scenario: Presentation surfaces show the placeholder

- **WHEN** a user opens a presentation view at `/head/report/[reportId]/present`
  or `/reports/[reportId]/present`
- **THEN** each presentation page header renders one `AgentReviewComingSoon`
  control

#### Scenario: Lead self-preview shows the placeholder

- **WHEN** a lead opens `/lead/report/[reportId]/preview` to read their own
  section as assembled
- **THEN** the preview page header renders one `AgentReviewComingSoon` control

#### Scenario: Slides and head shell keep their existing placeholder

- **WHEN** a user switches the Head report shell between form and slides modes
- **THEN** the outer Head report toolbar remains mounted and renders exactly one
  `AgentReviewComingSoon` control in either mode
- **AND** the nested Head slide article MUST NOT add a second placeholder

#### Scenario: Lead slides keep one placeholder

- **WHEN** a lead views their slide surface
- **THEN** that surface renders exactly one `AgentReviewComingSoon` control
