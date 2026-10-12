## ADDED Requirements

### Requirement: Item status changes refresh reported dependent errors

Changing an Item status MUST re-evaluate only previously reported next-step and pause-reason errors using the same current save rules. A corrected error MUST disappear before another Save; still-invalid content MUST retain its appropriate error. Pristine fields MUST NOT acquire errors merely from status selection. Unrelated errors, draft text, save payload, caps and dismissal/pending protections MUST remain.

#### Scenario: A completed-item next-step error is corrected by resuming

- **GIVEN** Save reported that a completed Item cannot retain its nonempty next step
- **WHEN** the user selects In progress without modifying the plan
- **THEN** the stale completed error disappears and the plan remains intact
- **AND** a still-over-limit plan retains its current limit error
- **AND** unrelated Description or stage errors remain
