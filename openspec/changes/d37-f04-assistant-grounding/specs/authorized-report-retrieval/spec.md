## ADDED Requirements

### Requirement: Authorized weekly Activity references preserve presentation

The Lead assistant `ReportAssistantService.answer` MUST resolve an authorized live Activity by its effective weekly title or catalogue name without changing its identity. Published references MUST use frozen snapshot labels. Foreign Activity presentation MUST remain excluded by the existing authorization lens.

#### Scenario: Lead names a weekly Activity title

- **WHEN** a Lead references the visible weekly title of an authorized live Activity
- **THEN** the assistant resolves the same Activity that its catalogue name identifies
- **AND** normalized matching and null or absent title fallback remain supported

#### Scenario: Foreign title remains private

- **WHEN** another Lead's Activity title is named through shared-product access
- **THEN** the assistant does not resolve or reveal that private Activity

### Requirement: Complete grounding obeys the configured estimated budget

The Lead assistant `ReportAssistantService.answer` MUST check the final serialized grounding estimate, including complete aggregates, against its existing configured context budget. If that shape exceeds the budget, it MUST return `result_set_too_large` before answer or citation-repair requests. It MUST NOT reduce complete counts or groups to fit the budget.

#### Scenario: Complete aggregates alone exceed the budget

- **WHEN** authorized complete groups exceed the configured grounding estimate budget even without answer evidence
- **THEN** the assistant returns `result_set_too_large` without requesting an answer or repair
- **AND** its authenticated-user lease is released

#### Scenario: Complete groups fit the budget

- **WHEN** the same complete groups fit the configured grounding estimate budget
- **THEN** the answer receives every group and the complete count
