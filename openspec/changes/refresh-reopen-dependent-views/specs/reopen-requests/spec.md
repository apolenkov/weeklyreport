## ADDED Requirements

### Requirement: Reopen decisions refresh dependent live report views

After a reopen decision settles on the dashboard or review/admin surface, the
client MUST refresh the request queue and count together with dependent live
report and review reads. An approved section MUST become visibly editable and
its dashboard row, valid actions, and submission total MUST reflect the server
state without a reload or navigation. A failed decision MUST retain the active
response note while refreshing potentially stale server state.

#### Scenario: Approval refreshes the dashboard report state

- **GIVEN** the dashboard shows a submitted section with a pending reopen request
- **WHEN** the head approves that request
- **THEN** the pending request leaves the queue
- **AND** the section's row and submission total reflect Draft without navigation
- **AND** actions requiring a submitted section are no longer offered for that row

#### Scenario: A failed decision refreshes state without discarding the note

- **GIVEN** a response note is being submitted from either reopen surface
- **WHEN** the decision request fails
- **THEN** the response note remains available for correction or retry
- **AND** dependent live report reads are refreshed alongside the request queue and count
