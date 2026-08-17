## MODIFIED Requirements

### Requirement: A strict SearchPlan expresses user intent without internal controls

`@customreport/shared` MUST implement a strict compact `SearchPlan` wire contract that preserves report periods, authors, subjects, stages, record kinds, item/risk/decision/status filters, retrieval mode, output mode, grouping, requested limit, and exhaustive intent. Mode-specific values MUST use discriminated objects and MUST be required only for the selected mode. An absent optional filter MUST mean that the dimension is unconstrained; unknown fields and contradictory combinations MUST be rejected. Similarity thresholds, vector dimensions, candidate limits, database IDs, clarification tokens, and ACL decisions MUST NOT be planner parameters.

#### Scenario: Planner requests last week's blockers

- **WHEN** the planner requests blocker or open-risk records for the previous report period
- **THEN** the shared schema accepts a compact plan containing that period and those filters without unrelated empty collections

#### Scenario: Planner requests one author's current work

- **WHEN** the planner requests current-period work for an author reference such as “Petrov”
- **THEN** the shared schema preserves the author reference for server-side authorized entity resolution
- **AND** it does not require unrelated subject, stage, decision, or risk fields

#### Scenario: Planner includes an internal control

- **WHEN** a plan contains a database identifier, ACL choice, vector dimension, similarity threshold, or unknown field
- **THEN** strict shared validation rejects the plan before retrieval

#### Scenario: Planner omits a mode-specific value

- **WHEN** a named-period or semantic-retrieval mode omits its required reference or query
- **THEN** shared validation rejects the plan without silently inventing the missing value
