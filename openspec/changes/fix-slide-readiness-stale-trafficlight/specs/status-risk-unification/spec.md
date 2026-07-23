## ADDED Requirements

### Requirement: Slide readiness derives project severity from the unified slide status model

The section-slide readiness model MUST count a real project as blocked or
at-risk from the same risk-derived product status used by that project's visible
slide badge. It MUST NOT derive project severity from persisted
`ReportSectionReadModel.projects[].trafficLight`. Synthetic cross-product slides
MUST NOT contribute a project severity count. Existing project-scoped risk-row
counts remain additive and MUST continue to contribute independently.

#### Scenario: Stale unbacked red does not block slide readiness

- **GIVEN** a real project whose persisted project traffic light and persisted
  owned-stage status are red
- **AND** the project has no backing risks
- **WHEN** the section slide model derives the product badge and readiness
- **THEN** the product badge is green
- **AND** the project contributes zero to `blockedCount` and `atRiskCount`
- **AND** the slide tone is not blocked by that stale severity
- **AND** the Risk story readiness item is optional and does not say “Explain
  the red or yellow signal”

#### Scenario: Risk-backed red remains blocked

- **GIVEN** a real project with a stage covered by one blocked project risk
- **AND** the persisted project traffic light is not red
- **WHEN** the section slide model derives the product badge and readiness
- **THEN** the product badge is red
- **AND** the derived project contributes one to `blockedCount`
- **AND** the blocked risk row contributes its existing independent count
- **AND** the slide tone is blocked and the Risk story readiness item is
  required

#### Scenario: Synthetic cross-product status is not a project count

- **GIVEN** a section projection containing a synthetic cross-product slide
- **WHEN** section readiness counts blocked and at-risk projects
- **THEN** only projected product ids backed by `section.projects` contribute
  project severity counts
