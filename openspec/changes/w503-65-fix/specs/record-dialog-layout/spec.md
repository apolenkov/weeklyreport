## ADDED Requirements

### Requirement: Priority rank selection MUST accept only whole ranks

The item priority rank select MUST report either `null` or a whole integer rank.
Any value that is not a strictly valid integer representation MUST be normalized
to `null` before it reaches the draft; a partial parse or `NaN` MUST NOT be
propagated.

#### Scenario: Priority selection hardening

- **WHEN** the priority rank select reports a value that is not a strictly valid
  integer representation (for example `"2foo"` or `"invalid"`)
- **THEN** the rank is normalized to `null` and the draft receives no partial
  number and no `NaN`
