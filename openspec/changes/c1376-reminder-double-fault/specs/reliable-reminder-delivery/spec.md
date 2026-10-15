## MODIFIED Requirements

### Requirement: An enqueue failure is recorded, not swallowed

Requesting a reminder execution MUST NOT leave a committed `queued` row with no
job when the enqueue fails synchronously and the database accepts the
compensating write. The enqueue call MUST be guarded, and a synchronous enqueue
throw MUST mark the just-inserted execution `failed` with an error message — a
loud terminal state — rather than leaving an invisible `queued` row. When the
compensating `failed` write itself is rejected, the enqueue error MUST still be
logged and the request MUST reject with the compensation error; it MUST NOT
return a `failed` execution that was not persisted. The durable row then stays
`queued`, and the stuck-queued reaper owns its recovery. A single recipient's
failure MUST NOT abort the remaining recipients of the same scheduler tick: each
recipient in the deadline and escalation fan-out MUST be isolated so the loop
continues past a failure.

#### Scenario: A synchronous enqueue throw marks the execution failed

- **GIVEN** a reminder execution row committed as `queued`
- **WHEN** the immediately following enqueue call throws (for example, the queue
  backend is unavailable)
- **THEN** the execution is marked `failed` with the enqueue error message
- **AND** it is not left in `queued` with no corresponding job

#### Scenario: One recipient's failure does not abort the tick

- **GIVEN** a scheduler tick fanning out reminders to several recipients
- **WHEN** the request for one recipient throws
- **THEN** the failure is logged and that recipient is skipped
- **AND** the remaining recipients of the same tick are still processed

#### Scenario: A rejected compensation leaves a recoverable queued row

- **GIVEN** a scheduler tick fanning out deadline reminders to two recipients
- **WHEN** the first recipient's enqueue throws and the database rejects the
  compensating `failed` write
- **THEN** the enqueue error is logged and that request rejects with the
  compensation error, never with a `failed` execution
- **AND** the tick counts that recipient as failed, not requested, and still
  records and enqueues the second recipient
- **AND** the first execution remains durably `queued` with no error and no
  `sentAt`
- **AND** after the stuck-queued timeout the reaper re-enqueues it once under its
  execution id, and exactly one compare-and-set claim succeeds
