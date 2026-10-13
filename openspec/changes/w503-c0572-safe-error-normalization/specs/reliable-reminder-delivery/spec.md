## ADDED Requirements

### Requirement: Error formatting preserves reminder failure transitions

The email-reminder worker MUST release an intermediate failed dispatch claim
or record the final dispatch failure even when inspecting or converting the
adapter's rejected value to text throws. Failed conversion MUST use the existing
`Unknown error` fallback. The worker MUST rethrow the original rejection.

#### Scenario: Unstringifiable rejection on the final attempt

- **WHEN** an adapter rejects the final SMTP attempt with a value whose text
  conversion throws
- **THEN** the worker records the reminder failure with `Unknown error`
- **AND** it rethrows the original rejected value without marking the reminder
  sent or releasing the terminal claim

#### Scenario: Unstringifiable rejection before the final attempt

- **WHEN** an adapter rejects an SMTP attempt with a value whose text conversion
  throws and another configured attempt remains
- **THEN** the worker releases the execution claim for the configured retry
- **AND** it rethrows the original rejected value without recording a terminal
  failure or marking the reminder sent
