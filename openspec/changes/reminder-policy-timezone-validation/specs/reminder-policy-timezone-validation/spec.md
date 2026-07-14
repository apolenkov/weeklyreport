## ADDED Requirements

### Requirement: Reminder policy timezone is validated as a real IANA identifier

MUST reject any `ReminderPolicy.timezone` value that is not a valid IANA time
zone identifier at the shared wire-format schema boundary
(`reminderPolicySchema`), the same boundary that already refines the
`validUntil >= validFrom` invariant against a bypass-the-UI malicious or
buggy admin client. A syntactically non-empty but non-IANA string (a typo,
an offset-style string, or an arbitrary value from a client that skips the
React form) MUST fail validation before it can be persisted, so it can never
reach `PolicyApplicatorService.computeFireAt` or the `ReminderRule` upsert.

#### Scenario: A valid IANA zone is accepted

- **WHEN** a reminder policy is saved with `timezone: "Europe/Moscow"` (or
  any other valid IANA identifier)
- **THEN** the schema accepts the value

#### Scenario: An invalid timezone string is rejected at the schema boundary

- **WHEN** a reminder policy is saved with a `timezone` value that is not a
  valid IANA identifier (for example a typo, `"UTC+3"`, or an arbitrary
  client-supplied string)
- **THEN** the schema rejects the payload with a validation error pointing
  at the `timezone` field
- **AND** no `Report`/`ReminderPolicy` write and no `ReminderRule`
  materialization is attempted with that value

#### Scenario: A bad timezone can no longer abort reminder-rule creation for an entire period

- **GIVEN** an admin attempts to save a policy with an invalid timezone
- **WHEN** the schema rejects it at save time
- **THEN** `PolicyApplicatorService.applyToPeriod` never receives that
  policy, so no OTHER valid policy's `ReminderRule` materialization for the
  same period is ever aborted by it
