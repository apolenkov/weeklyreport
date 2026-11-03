## ADDED Requirements

### Requirement: A frozen prior commitment can be continued without rewriting history

Previously planned MUST remain read-only. Eligible prior work MUST be continuable in Current through the existing verdict and continuation owners, without rewriting a prior record or snapshot, duplicating a stableId or silently overwriting a conflicting continuation. Existing eligible verdicts and reason requirements remain available.

#### Scenario: Continue a previous commitment already carried forward

- **WHEN** a prior commitment already has a carried Current occurrence and the Lead chooses Continue
- **THEN** the existing Current occurrence is confirmed or opened for further work without creating another occurrence
- **AND** the prior record and its frozen snapshot are unchanged

#### Scenario: Only a linked Next occurrence exists

- **WHEN** a Lead continues an eligible previous commitment and the selected week has a linked Next occurrence but no Current occurrence
- **THEN** the existing linked-item planner handles it under its existing conflict and promotion rules
- **AND** it does not blindly create an additional Current occurrence or overwrite an explicit Next commitment

#### Scenario: Neither selected-week occurrence exists

- **WHEN** a Lead continues an eligible previous commitment and neither Current nor Next occurrence exists
- **THEN** the existing prior-plan outcome command records the selected-week result under the same stableId and retains its audit event
- **AND** a retry of the same command identity is handled under the existing replay rules without modifying the previous snapshot

#### Scenario: Conflicting continuations exist

- **WHEN** selected-week occurrences conflict or contain a different explicit continuation
- **THEN** existing conflict selection and history rules apply without silent replacement or duplicate active occurrences
