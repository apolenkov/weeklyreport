# behavioral-ui-regression-gate Specification

## Purpose

Keep human and model product review advisory so it can surface candidates
without becoming a second acceptance authority for WeeklyReport.

## Requirements

### Requirement: Human and AI review is advisory

Human or model-driven browser review MAY inspect WeeklyReport, but MUST NOT
write or replace the deterministic acceptance verdict. A candidate blocks only
after deterministic reproduction or reviewed product evidence.

#### Scenario: Advisory review reports a candidate

- **WHEN** a human or model reports a possible browser defect
- **THEN** the candidate is reproduced or reviewed before it affects acceptance
