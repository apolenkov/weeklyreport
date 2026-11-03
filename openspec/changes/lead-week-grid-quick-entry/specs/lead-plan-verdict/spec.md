## ADDED Requirements

### Requirement: A frozen prior commitment can be continued without rewriting history

Previously planned MUST remain read-only. Eligible prior work MUST be continuable in Current through the existing verdict and continuation owners, without rewriting a prior record or snapshot, duplicating a stableId or silently overwriting a conflicting continuation. Existing eligible verdicts and reason requirements remain available.

#### Scenario: Continue a previous commitment already carried forward

- **WHEN** a prior commitment already has a carried Current occurrence and the Lead chooses Continue
- **THEN** the existing Current occurrence is confirmed or opened for further work without creating another occurrence
- **AND** the prior record and its frozen snapshot are unchanged

#### Scenario: No Current occurrence exists

- **WHEN** a Lead continues an eligible previous commitment with no selected-week occurrence
- **THEN** the existing prior-plan outcome path creates the selected-week occurrence once under the same stableId
- **AND** retries do not change the prior snapshot or create duplicates
