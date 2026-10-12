## MODIFIED Requirements

### Requirement: Non-lead summaries describe periods, not personal submissions

For roles other than lead, the history summary rail MUST be titled as a
portfolio summary, MUST label the completed-over-total ratio "Periods completed",
and MUST phrase its streak as "Completed N weeks in a row". Lead copy
("My History Summary", "Submissions", "Submitted N weeks in a row") is unchanged.

#### Scenario: Viewer opens History

- **WHEN** a viewer opens `/reports`
- **THEN** the rail is titled "Portfolio History Summary"
- **AND** it shows "Periods completed" and never "Submissions"

#### Scenario: A single completed or incomplete recent entry is described

- **WHEN** the streak is one or the most recent reporting period is incomplete, including reopened
- **THEN** copy names the most recent period without inventing last-week recency or draft status, and uses completed for viewer mode and submitted for Lead completion
